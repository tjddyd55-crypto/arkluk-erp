import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { emailStaffOrderSupplierPoPdf } from "@/server/services/order-po-email-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderSupplierId: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id, orderSupplierId: sid } = await params;
    const orderId = Number(id);
    const orderSupplierId = Number(sid);
    if (Number.isNaN(orderId) || Number.isNaN(orderSupplierId)) {
      throw new HttpError(400, "유효하지 않은 ID입니다.");
    }

    const os = await prisma.orderSupplier.findFirst({
      where: { id: orderSupplierId, order_id: orderId },
      select: { id: true },
    });
    if (!os) {
      throw new HttpError(404, "공급사 주문 구간을 찾을 수 없습니다.");
    }

    const result = await emailStaffOrderSupplierPoPdf({
      orderId,
      orderSupplierId,
      staffUserId: user.id,
    });
    if (!result.success) {
      throw new HttpError(502, result.errorMessage ?? "메일 발송에 실패했습니다.");
    }

    return ok({ mocked: result.mocked });
  } catch (error) {
    return handleRouteError(error);
  }
}
