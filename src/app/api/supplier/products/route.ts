import { NextRequest } from "next/server";
import { Prisma, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { productCategoryForWrite } from "@/lib/product-category-policy";
import { prisma } from "@/lib/prisma";
import {
  supplierDynamicProductUpsertSchema,
  supplierProductCreateSchema,
} from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";
import { generateProductTranslations } from "@/server/services/product-translation-service";
import { validateAndNormalizeDynamicValues, upsertSupplierProductFieldValues } from "@/server/services/supplier-dynamic-product-service";
import { getSupplierActiveProductForm } from "@/server/services/supplier-product-form-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const products = await prisma.product.findMany({
      where: {
        supplier_id: supplierId,
      },
      include: {
        category: true,
        field_values: {
          include: {
            field: {
              select: {
                id: true,
                field_key: true,
                field_label: true,
              },
            },
          },
        },
      },
      orderBy: [{ category_id: "asc" }, { sort_order: "asc" }],
    });
    return ok(
      products.map((product) => ({
        ...product,
        dynamic_values: product.field_values.reduce<Record<string, string | null>>((acc, row) => {
          acc[row.field.field_key] = row.value_text;
          return acc;
        }, {}),
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const rawBody = await request.json();
    const dynamicParsed = supplierDynamicProductUpsertSchema.safeParse(rawBody);
    const legacyParsed = dynamicParsed.success
      ? null
      : supplierProductCreateSchema.safeParse(rawBody);
    if (!dynamicParsed.success && !legacyParsed?.success) {
      throw new HttpError(400, "상품 등록 값이 올바르지 않습니다.");
    }
    const legacyData = legacyParsed && legacyParsed.success ? legacyParsed.data : null;

    const dynamicPayload = dynamicParsed.success
      ? dynamicParsed.data
      : {
          categoryId: legacyData!.categoryId,
          sourceLanguage: legacyData!.sourceLanguage,
          imageUrl: legacyData!.thumbnailUrl ?? null,
          formValues: {
            name: legacyData!.name,
            sku: legacyData!.sku,
            description: legacyData!.description ?? "",
            specification: legacyData!.specification,
            price: legacyData!.price,
            currency: legacyData!.currency,
          },
        };
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { country_code: true, productCategory: true },
    });
    if (!supplier) {
      throw new HttpError(400, "공급사 정보를 찾을 수 없습니다.");
    }

    const category = await prisma.category.findFirst({
      where: {
        id: dynamicPayload.categoryId,
        supplier_id: supplierId,
        is_active: true,
      },
      select: { id: true },
    });
    if (!category) {
      throw new HttpError(400, "해당 공급사에서 사용할 수 없는 카테고리입니다.");
    }

    const existing = await prisma.product.findFirst({
      where: {
        supplier_id: supplierId,
        OR: [
          { sku: String(dynamicPayload.formValues.sku ?? "").trim() },
          { product_code: String(dynamicPayload.formValues.sku ?? "").trim() },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new HttpError(409, "이미 등록된 SKU입니다.");
    }

    const form = await getSupplierActiveProductForm(supplierId, user.id);
    const normalized = validateAndNormalizeDynamicValues({
      fields: form.fields,
      values: dynamicPayload.formValues,
    });

    const created = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          supplier_id: supplierId,
          category_id: dynamicPayload.categoryId,
          productCategory: productCategoryForWrite(supplier.productCategory),
          country_code: supplier.country_code,
          name_original: normalized.productCore.name,
          description_original: normalized.productCore.description,
          source_language: dynamicPayload.sourceLanguage ?? "ko",
          name: normalized.productCore.name,
          sku: normalized.productCore.sku,
          description: normalized.productCore.description,
          specification: normalized.productCore.specification,
          price: new Prisma.Decimal(normalized.productCore.price),
          currency: normalized.productCore.currency,
          thumbnail_url: dynamicPayload.imageUrl ?? null,
          image_url: dynamicPayload.imageUrl ?? null,
          status: ProductStatus.DRAFT,
          is_active: false,
          product_code: normalized.productCore.sku,
          product_name: normalized.productCore.name,
          product_image_url: dynamicPayload.imageUrl ?? null,
          spec: normalized.productCore.specification,
          unit: normalized.productCore.unit,
          memo: normalized.productCore.description ?? null,
        },
      });

      await upsertSupplierProductFieldValues(tx, {
        productId: newProduct.id,
        formId: form.id,
        fields: form.fields,
        normalizedValues: normalized.normalizedValues,
      });

      return newProduct;
    });

    await generateProductTranslations({
      productId: created.id,
      nameOriginal: created.name_original,
      descriptionOriginal: created.description_original,
      sourceLanguage: created.source_language,
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_CREATE_PRODUCT_DRAFT",
      targetType: "PRODUCT",
      targetId: created.id,
      afterData: {
        status: created.status,
        sku: created.sku,
        formId: form.id,
      },
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
