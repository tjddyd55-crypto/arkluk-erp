import { NextRequest } from "next/server";
import { Prisma, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  supplierDynamicProductPatchSchema,
  supplierProductUpdateSchema,
} from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";
import { generateProductTranslations } from "@/server/services/product-translation-service";
import {
  upsertSupplierProductFieldValues,
  validateAndNormalizeDynamicValues,
} from "@/server/services/supplier-dynamic-product-service";
import { getSupplierActiveProductForm } from "@/server/services/supplier-product-form-service";
import { deleteSupplierProductImageIfOwned } from "@/server/services/supplier-product-image-storage";

function mergeLegacyPatchValues(
  formValues: Record<string, unknown>,
  legacy: Partial<{
    name: string;
    sku: string;
    description: string | null;
    specification: string;
    price: number;
    currency: string;
  }>,
) {
  const next = { ...formValues };
  if (legacy.name !== undefined) next.name = legacy.name;
  if (legacy.sku !== undefined) next.sku = legacy.sku;
  if (legacy.description !== undefined) next.description = legacy.description ?? "";
  if (legacy.specification !== undefined) next.specification = legacy.specification;
  if (legacy.price !== undefined) next.price = legacy.price;
  if (legacy.currency !== undefined) next.currency = legacy.currency;
  return next;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const body = await request.json();
    const dynamicParsed = supplierDynamicProductPatchSchema.safeParse(body);
    const legacyParsed = dynamicParsed.success ? null : supplierProductUpdateSchema.safeParse(body);
    if (!dynamicParsed.success && !legacyParsed?.success) {
      throw new HttpError(400, "상품 수정 값이 올바르지 않습니다.");
    }
    const legacyData = legacyParsed && legacyParsed.success ? legacyParsed.data : null;

    const before = await prisma.product.findFirst({
      where: { id: productId, supplier_id: supplierId },
      include: {
        field_values: {
          include: {
            field: {
              select: { id: true, form_id: true, field_key: true },
            },
          },
        },
      },
    });
    if (!before) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }
    if (before.status !== ProductStatus.DRAFT && before.status !== ProductStatus.REJECTED) {
      throw new HttpError(400, "DRAFT 또는 REJECTED 상태 상품만 수정할 수 있습니다.");
    }

    const categoryId = dynamicParsed.success ? dynamicParsed.data.categoryId : legacyData?.categoryId;

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          supplier_id: supplierId,
          is_active: true,
        },
      });
      if (!category) {
        throw new HttpError(400, "해당 공급사에서 사용할 수 없는 카테고리입니다.");
      }
    }
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { country_code: true },
    });
    if (!supplier) {
      throw new HttpError(400, "공급사 정보를 찾을 수 없습니다.");
    }

    const currentForm = await getSupplierActiveProductForm(supplierId, user.id);
    const existingValues = before.field_values.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.field.field_key] = row.value_text;
      return acc;
    }, {});

    const mergedValues = dynamicParsed.success
      ? { ...existingValues, ...(dynamicParsed.data.formValues ?? {}) }
      : mergeLegacyPatchValues(existingValues, legacyData ?? {});

    const normalized = validateAndNormalizeDynamicValues({
      fields: currentForm.fields,
      values: mergedValues,
    });

    if (
      normalized.productCore.sku !== before.sku &&
      normalized.productCore.sku !== before.product_code
    ) {
      const duplicate = await prisma.product.findFirst({
        where: {
          supplier_id: supplierId,
          id: { not: productId },
          OR: [
            { sku: normalized.productCore.sku },
            { product_code: normalized.productCore.sku },
          ],
        },
      });
      if (duplicate) {
        throw new HttpError(409, "이미 등록된 SKU입니다.");
      }
    }

    const nextImageUrl = dynamicParsed.success
      ? (dynamicParsed.data.imageUrl === undefined ? before.image_url : dynamicParsed.data.imageUrl)
      : (legacyData?.thumbnailUrl === undefined
          ? before.image_url
          : legacyData.thumbnailUrl);
    const nextSourceLanguage = dynamicParsed.success
      ? (dynamicParsed.data.sourceLanguage ?? before.source_language)
      : (legacyData?.sourceLanguage ?? before.source_language);

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.product.update({
        where: { id: productId },
        data: {
          category_id: categoryId ?? before.category_id,
          country_code: supplier.country_code,
          name_original: normalized.productCore.name,
          description_original: normalized.productCore.description,
          source_language: nextSourceLanguage,
          name: normalized.productCore.name,
          sku: normalized.productCore.sku,
          description: normalized.productCore.description,
          specification: normalized.productCore.specification,
          product_name: normalized.productCore.name,
          product_code: normalized.productCore.sku,
          product_image_url: nextImageUrl ?? null,
          thumbnail_url: nextImageUrl ?? null,
          image_url: nextImageUrl ?? null,
          spec: normalized.productCore.specification,
          price: new Prisma.Decimal(normalized.productCore.price),
          currency: normalized.productCore.currency,
          memo: normalized.productCore.description,
          unit: normalized.productCore.unit,
          status: ProductStatus.DRAFT,
          rejection_reason: null,
        },
      });

      await upsertSupplierProductFieldValues(tx, {
        productId: productId,
        formId: currentForm.id,
        fields: currentForm.fields,
        normalizedValues: normalized.normalizedValues,
      });

      return next;
    });

    await generateProductTranslations({
      productId: updated.id,
      nameOriginal: updated.name_original,
      descriptionOriginal: updated.description_original,
      sourceLanguage: updated.source_language,
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_UPDATE_PRODUCT",
      targetType: "PRODUCT",
      targetId: productId,
      beforeData: before,
      afterData: updated,
    });

    const prevImage = before.image_url;
    const nextImage = nextImageUrl ?? null;
    if ((prevImage ?? "") !== (nextImage ?? "")) {
      try {
        await deleteSupplierProductImageIfOwned(supplierId, prevImage);
      } catch {
        /* 스토리지 삭제 실패는 상품 수정 결과를 막지 않음 */
      }
    }

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId;
    if (!supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const before = await prisma.product.findFirst({
      where: { id: productId, supplier_id: supplierId },
    });
    if (!before) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }

    const imagePathBeforeDelete = before.image_url;

    await prisma.$transaction(async (tx) => {
      await tx.productApprovalLog.deleteMany({
        where: { product_id: productId },
      });
      await tx.productTranslation.deleteMany({
        where: { product_id: productId },
      });
      await tx.product.delete({
        where: { id: productId },
      });
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_DELETE_PRODUCT",
      targetType: "PRODUCT",
      targetId: productId,
      beforeData: before,
    });

    try {
      await deleteSupplierProductImageIfOwned(supplierId, imagePathBeforeDelete);
    } catch {
      /* 스토리지 삭제 실패는 삭제 응답을 막지 않음 */
    }

    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
