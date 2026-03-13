import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { addCountryOrderItemsSchema } from "@/lib/schemas";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { addCountryOrderItems } from "@/server/services/order-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    if (user.role !== Role.COUNTRY_ADMIN) {
      throw new HttpError(403, "COUNTRY_ADMIN만 국가 주문 품목을 추가할 수 있습니다.");
    }

    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const parsed = addCountryOrderItemsSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "주문 품목 요청 형식이 올바르지 않습니다.");
    }

    const order = await addCountryOrderItems(orderId, {
      actorId: user.id,
      items: parsed.data.items,
    });
    return ok(order);
  } catch (error) {
    return handleRouteError(error);
  }
}
