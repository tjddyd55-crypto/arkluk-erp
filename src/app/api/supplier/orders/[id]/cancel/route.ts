import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";

export async function POST(
  request: NextRequest,
) {
  try {
    await requireAuth(request, ["SUPPLIER"]);
    throw new HttpError(
      403,
      "SUPPLIER는 Order 상태를 변경할 수 없습니다. Shipment 상태만 변경 가능합니다.",
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
