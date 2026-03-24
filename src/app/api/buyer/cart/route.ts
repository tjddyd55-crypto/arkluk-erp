import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { getBuyerCartDetail } from "@/server/services/buyer-cart-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const data = await getBuyerCartDetail(user.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
