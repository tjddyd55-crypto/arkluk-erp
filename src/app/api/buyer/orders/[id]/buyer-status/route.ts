import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { buyerOrderStatusUpdateSchema } from "@/lib/schemas";
import { buyerUpdateOrderStatus } from "@/server/services/order-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    if (user.role !== Role.BUYER) {
      throw new HttpError(403, "BUYER만 주문 상태를 변경할 수 있습니다.");
    }

    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = buyerOrderStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "주문 상태 변경 요청 형식이 올바르지 않습니다.");
    }

    const updated = await buyerUpdateOrderStatus(orderId, user.id, parsed.data.status);
    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
