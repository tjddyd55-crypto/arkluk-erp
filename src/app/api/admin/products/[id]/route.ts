import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  assertProductInvariantBeforeWrite,
  productCategoryForWrite,
} from "@/lib/product-category-policy";
import { prisma } from "@/lib/prisma";
import { productUpsertSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";
import { generateProductTranslations } from "@/server/services/product-translation-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const body = await request.json();
    const parsed = productUpsertSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "상품 수정 값이 올바르지 않습니다.");
    }

    const before = await prisma.product.findUnique({ where: { id: productId } });
    if (!before) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }
    const resolvedSupplierId = parsed.data.supplierId ?? before.supplier_id;
    const previousSupplier = await prisma.supplier.findUnique({
      where: { id: before.supplier_id },
      select: { productCategory: true },
    });
    if (!previousSupplier) {
      throw new HttpError(400, "상품의 공급사 정보를 찾을 수 없습니다.");
    }
    const supplier = await prisma.supplier.findUnique({
      where: { id: resolvedSupplierId },
      select: { country_code: true, productCategory: true },
    });
    if (!supplier) {
      throw new HttpError(400, "공급사를 찾을 수 없습니다.");
    }

    assertProductInvariantBeforeWrite({
      product: before,
      targetSupplierId: resolvedSupplierId,
      targetSupplierCategory: supplier.productCategory,
      previousSupplierCategory: previousSupplier.productCategory,
    });

    const line = productCategoryForWrite(supplier.productCategory);

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        supplier_id: parsed.data.supplierId,
        category_id: parsed.data.categoryId,
        productCategory: line,
        country_code: parsed.data.countryCode ?? supplier.country_code,
        name_original: parsed.data.productName,
        description_original: parsed.data.memo,
        source_language: parsed.data.sourceLanguage,
        name: parsed.data.productName,
        sku: parsed.data.productCode,
        description: parsed.data.memo,
        specification: parsed.data.spec,
        product_code: parsed.data.productCode,
        product_name: parsed.data.productName,
        thumbnail_url: parsed.data.productImageUrl,
        currency: parsed.data.currency,
        status: parsed.data.status,
        product_image_url: parsed.data.productImageUrl,
        spec: parsed.data.spec,
        unit: parsed.data.unit,
        price: parsed.data.price ? new Prisma.Decimal(parsed.data.price) : undefined,
        memo: parsed.data.memo,
        sort_order: parsed.data.sortOrder,
        is_active: parsed.data.isActive,
      },
    });

    await generateProductTranslations({
      productId: updated.id,
      nameOriginal: updated.name_original,
      descriptionOriginal: updated.description_original,
      sourceLanguage: updated.source_language,
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "UPDATE_PRODUCT",
      targetType: "PRODUCT",
      targetId: productId,
      beforeData: before,
      afterData: updated,
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
