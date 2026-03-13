import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { orderItemAssignSchema } from "@/lib/schemas";
import { assignOrderItemSupplier } from "@/server/services/order-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const body = await request.json();
    const parsed = orderItemAssignSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "주문 품목 배정 요청 형식이 올바르지 않습니다.");
    }

    const item = await assignOrderItemSupplier(orderId, user.id, {
      orderItemId: parsed.data.orderItemId,
      supplierId: parsed.data.supplierId,
      mode: "MANUAL",
    });

    return ok(item);
  } catch (error) {
    return handleRouteError(error);
  }
}
