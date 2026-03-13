import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function POST(
  request: NextRequest,
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    throw new HttpError(403, "관리자 계정은 주문 상태를 변경할 수 없습니다. 조회만 가능합니다.");
  } catch (error) {
    return handleRouteError(error);
  }
}
