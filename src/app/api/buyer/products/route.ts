import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { toNumber } from "@/lib/utils";
import { getBuyerProductsPayload } from "@/server/services/buyer-cart-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const supplierId = toNumber(request.nextUrl.searchParams.get("supplierId"));
    if (!supplierId) {
      throw new HttpError(400, "supplierId가 필요합니다.");
    }
    const data = await getBuyerProductsPayload(supplierId, user.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
