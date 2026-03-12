import { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    return ok(user);
  } catch (error) {
    return handleRouteError(error);
  }
}
