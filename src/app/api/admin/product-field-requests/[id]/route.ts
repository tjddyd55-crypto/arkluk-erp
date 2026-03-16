import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { supplierProductFieldRequestReviewSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const requestId = Number(id);
    if (Number.isNaN(requestId)) {
      throw new HttpError(400, "유효하지 않은 요청 ID입니다.");
    }

    const parsed = supplierProductFieldRequestReviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "요청 처리 값이 올바르지 않습니다.");
    }

    const before = await prisma.supplierProductFieldRequest.findUnique({
      where: { id: requestId },
    });
    if (!before) {
      throw new HttpError(404, "필드 요청을 찾을 수 없습니다.");
    }

    const updated = await prisma.supplierProductFieldRequest.update({
      where: { id: requestId },
      data: {
        status: parsed.data.status,
        reviewed_by: user.id,
        reviewed_at: new Date(),
      },
      include: {
        supplier: {
          select: { id: true, supplier_name: true, company_name: true },
        },
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "ADMIN_REVIEW_PRODUCT_FIELD_REQUEST",
      targetType: "SUPPLIER",
      targetId: updated.supplier_id,
      beforeData: { status: before.status, requestId },
      afterData: { status: updated.status, requestId },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
