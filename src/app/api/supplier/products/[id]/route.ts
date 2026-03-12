import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { productUpsertSchema } from "@/lib/schemas";
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

    const supplier = await prisma.supplier.findUnique({
      where: { id: user.supplierId },
      select: { allow_supplier_product_edit: true },
    });
    if (!supplier?.allow_supplier_product_edit) {
      throw new HttpError(403, "현재 공급사 상품 수정 권한이 비활성화되어 있습니다.");
    }

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

    const before = await prisma.product.findFirst({
      where: { id: productId, supplier_id: user.supplierId },
    });
    if (!before) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        category_id: parsed.data.categoryId,
        product_name: parsed.data.productName,
        product_image_url: parsed.data.productImageUrl,
        spec: parsed.data.spec,
        unit: parsed.data.unit,
        price: parsed.data.price ? new Prisma.Decimal(parsed.data.price) : undefined,
        memo: parsed.data.memo,
        is_active: parsed.data.isActive,
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
