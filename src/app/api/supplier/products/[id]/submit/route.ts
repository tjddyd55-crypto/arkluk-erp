import { NextRequest } from "next/server";
import { ProductApprovalAction, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierProductSubmitSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const parsed = supplierProductSubmitSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HttpError(400, "상품 제출 값이 올바르지 않습니다.");
    }

    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const before = await prisma.product.findFirst({
      where: { id: productId, supplier_id: user.supplierId },
    });
    if (!before) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }
    if (before.status !== ProductStatus.DRAFT && before.status !== ProductStatus.REJECTED) {
      throw new HttpError(400, "DRAFT 또는 REJECTED 상태 상품만 제출할 수 있습니다.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.APPROVED,
          is_active: true,
          rejection_reason: null,
        },
      });

      await tx.productApprovalLog.create({
        data: {
          product_id: productId,
          action: ProductApprovalAction.SUBMIT,
          actor_user_id: user.id,
          reason: null,
        },
      });

      await tx.productApprovalLog.create({
        data: {
          product_id: productId,
          action: ProductApprovalAction.APPROVE,
          actor_user_id: user.id,
          reason: "제출 시 자동 승인",
        },
      });

      return next;
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_SUBMIT_PRODUCT",
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
