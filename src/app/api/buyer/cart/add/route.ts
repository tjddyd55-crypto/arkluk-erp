import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { buyerCartAddSchema } from "@/lib/schemas";
import { addBuyerCartItem } from "@/server/services/buyer-cart-service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const parsed = buyerCartAddSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "장바구니 추가 요청 형식이 올바르지 않습니다.");
    }
    const row = await addBuyerCartItem({
      buyerId: user.id,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
    });
    return ok(row, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
