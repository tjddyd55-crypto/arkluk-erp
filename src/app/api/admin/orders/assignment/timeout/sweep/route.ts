import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { runTimeoutAutoAssignmentSweep } from "@/server/services/order-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const result = await runTimeoutAutoAssignmentSweep(user.id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
