import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { buyerOrderCheckoutFromCartSchema, createOrderSchema } from "@/lib/schemas";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkoutBuyerCart } from "@/server/services/buyer-cart-service";
import { createOrder } from "@/server/services/order-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const where =
      user.role === Role.COUNTRY_ADMIN
        ? {
            country_id: user.countryId!,
          }
        : {
            buyer_id: user.id,
          };

    const orders = await prisma.order.findMany({
      where,
      include: {
        country: true,
        buyer: true,
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

    const cartCheckout = buyerOrderCheckoutFromCartSchema.safeParse(body);
    if (cartCheckout.success) {
      const order = await checkoutBuyerCart({
        buyerId: user.id,
        memo: cartCheckout.data.memo,
      });
      return ok(order, { status: 201 });
    }

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
