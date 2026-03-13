import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { toNumber } from "@/lib/utils";
import { listUserNotifications } from "@/server/services/notification-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const limit = toNumber(request.nextUrl.searchParams.get("limit"), 20) ?? 20;
    const result = await listUserNotifications(user.id, limit);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
