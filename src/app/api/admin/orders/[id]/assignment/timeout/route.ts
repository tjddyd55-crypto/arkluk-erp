import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { autoAssignOrderItemsByTimeout } from "@/server/services/order-service";

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

    const result = await autoAssignOrderItemsByTimeout(orderId, user.id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
