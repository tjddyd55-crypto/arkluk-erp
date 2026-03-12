import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { taxInvoiceLinkSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const invoiceId = Number(id);
    if (Number.isNaN(invoiceId)) {
      throw new HttpError(400, "유효하지 않은 세금계산서 ID입니다.");
    }

    const body = await request.json();
    const parsed = taxInvoiceLinkSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "주문 연결 요청 형식이 올바르지 않습니다.");
    }

    let orderId = parsed.data.orderId ?? null;
    if (parsed.data.orderNo) {
      const order = await prisma.order.findFirst({
        where: { order_no: parsed.data.orderNo.trim().toUpperCase() },
        select: { id: true },
      });
      if (!order) {
        throw new HttpError(404, "주문번호에 해당하는 주문을 찾을 수 없습니다.");
      }
      orderId = order.id;
    }

    const before = await prisma.taxInvoice.findUnique({
      where: { id: invoiceId },
      select: { order_id: true, order_link_type: true },
    });
    if (!before) {
      throw new HttpError(404, "세금계산서를 찾을 수 없습니다.");
    }

    const updated = await prisma.taxInvoice.update({
      where: { id: invoiceId },
      data: {
        order_id: orderId,
        order_link_type: orderId ? "MANUAL" : null,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "LINK_TAX_INVOICE_ORDER",
      targetType: "TAX_INVOICE",
      targetId: invoiceId,
      beforeData: before,
      afterData: { orderId: updated.order_id, orderLinkType: updated.order_link_type },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
