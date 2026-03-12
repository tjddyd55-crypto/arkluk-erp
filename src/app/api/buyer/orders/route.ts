import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { createOrderSchema } from "@/lib/schemas";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/server/services/order-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);

    const orders = await prisma.order.findMany({
      where: {
        buyer_id: user.id,
      },
      include: {
        country: true,
        suppliers: {
          include: { supplier: true },
        },
      },
      orderBy: [{ created_at: "desc" }],
    });

    return ok(orders);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "주문 요청 형식이 올바르지 않습니다.");
    }

    const order = await createOrder({
      buyerId: user.id,
      projectId: parsed.data.projectId,
      memo: parsed.data.memo,
      items: parsed.data.items,
    });
    return ok(order, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
