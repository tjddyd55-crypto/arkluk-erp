import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { submitCountryOrder } from "@/server/services/order-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    if (user.role !== Role.COUNTRY_ADMIN) {
      throw new HttpError(403, "COUNTRY_ADMIN만 국가 주문을 제출할 수 있습니다.");
    }

    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const order = await submitCountryOrder(orderId, user.id);
    return ok(order);
  } catch (error) {
    return handleRouteError(error);
  }
}
