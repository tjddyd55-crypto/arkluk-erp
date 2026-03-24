import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { buyerCartItemDeleteSchema, buyerCartItemPatchSchema } from "@/lib/schemas";
import { removeBuyerCartItem, updateBuyerCartItem } from "@/server/services/buyer-cart-service";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const parsed = buyerCartItemPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "장바구니 수정 요청 형식이 올바르지 않습니다.");
    }
    const row = await updateBuyerCartItem({
      buyerId: user.id,
      itemId: parsed.data.itemId,
      quantity: parsed.data.quantity,
    });
    return ok(row);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const parsed = buyerCartItemDeleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "장바구니 삭제 요청 형식이 올바르지 않습니다.");
    }
    await removeBuyerCartItem({ buyerId: user.id, itemId: parsed.data.itemId });
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
