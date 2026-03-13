import { NextRequest } from "next/server";
import { Prisma, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierProductUpdateSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const body = await request.json();
    const parsed = supplierProductUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "상품 수정 값이 올바르지 않습니다.");
    }

    const before = await prisma.product.findFirst({
      where: { id: productId, supplier_id: user.supplierId },
    });
    if (!before) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }
    if (before.status !== ProductStatus.DRAFT && before.status !== ProductStatus.REJECTED) {
      throw new HttpError(400, "DRAFT 또는 REJECTED 상태 상품만 수정할 수 있습니다.");
    }

    if (parsed.data.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: parsed.data.categoryId,
          supplier_id: user.supplierId,
          is_active: true,
        },
      });
      if (!category) {
        throw new HttpError(400, "해당 공급사에서 사용할 수 없는 카테고리입니다.");
      }
    }

    if (parsed.data.sku && parsed.data.sku !== before.sku && parsed.data.sku !== before.product_code) {
      const duplicate = await prisma.product.findFirst({
        where: {
          supplier_id: user.supplierId,
          id: { not: productId },
          OR: [{ sku: parsed.data.sku }, { product_code: parsed.data.sku }],
        },
      });
      if (duplicate) {
        throw new HttpError(409, "이미 등록된 SKU입니다.");
      }
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        category_id: parsed.data.categoryId,
        name: parsed.data.name,
        sku: parsed.data.sku,
        description: parsed.data.description,
        specification: parsed.data.specification,
        product_name: parsed.data.name,
        product_code: parsed.data.sku,
        product_image_url: parsed.data.thumbnailUrl,
        thumbnail_url: parsed.data.thumbnailUrl,
        spec: parsed.data.specification,
        price: parsed.data.price ? new Prisma.Decimal(parsed.data.price) : undefined,
        currency: parsed.data.currency,
        memo: parsed.data.description,
        status: ProductStatus.DRAFT,
        rejection_reason: null,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_UPDATE_PRODUCT",
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
