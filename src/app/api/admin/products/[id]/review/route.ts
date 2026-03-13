import { NextRequest } from "next/server";
import { ProductApprovalAction, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { productReviewSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const parsed = productReviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "승인 요청 값이 올바르지 않습니다.");
    }

    const before = await prisma.product.findUnique({ where: { id: productId } });
    if (!before) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }
    if (before.status !== ProductStatus.PENDING) {
      throw new HttpError(400, "승인 대기(PENDING) 상품만 검토할 수 있습니다.");
    }

    const nextStatus =
      parsed.data.status === "APPROVED" ? ProductStatus.APPROVED : ProductStatus.REJECTED;
    const rejectionReason = parsed.data.reason?.trim() ?? null;

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.product.update({
        where: { id: productId },
        data: {
          status: nextStatus,
          is_active: nextStatus === ProductStatus.APPROVED ? true : false,
          rejection_reason: nextStatus === ProductStatus.REJECTED ? rejectionReason : null,
        },
      });

      await tx.productApprovalLog.create({
        data: {
          product_id: productId,
          action:
            nextStatus === ProductStatus.APPROVED
              ? ProductApprovalAction.APPROVE
              : ProductApprovalAction.REJECT,
          actor_user_id: actor.id,
          reason: nextStatus === ProductStatus.REJECTED ? rejectionReason : null,
        },
      });

      return next;
    });

    await createAuditLog({
      actorId: actor.id,
      actionType: "REVIEW_SUPPLIER_PRODUCT",
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
