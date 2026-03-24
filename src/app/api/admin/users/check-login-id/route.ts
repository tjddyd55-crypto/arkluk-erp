import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

function normalizeLoginId(raw: string) {
  return raw.trim().toLowerCase();
}

/** GET ?loginId=&excludeUserId= (수정 시 본인 계정 제외) */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const loginIdRaw = request.nextUrl.searchParams.get("loginId") ?? "";
    const loginId = normalizeLoginId(loginIdRaw);
    if (loginId.length < 3) {
      return ok({ available: false as const, reason: "SHORT" as const });
    }
    if (/\s/.test(loginIdRaw.trim())) {
      return ok({ available: false as const, reason: "WHITESPACE" as const });
    }

    const excludeParam = request.nextUrl.searchParams.get("excludeUserId");
    const excludeUserId =
      excludeParam != null && excludeParam !== "" ? Number(excludeParam) : NaN;
    const excludeId = Number.isInteger(excludeUserId) && excludeUserId > 0 ? excludeUserId : null;

    const existing = await prisma.user.findUnique({
      where: { login_id: loginId },
      select: { id: true },
    });

    if (!existing) {
      return ok({ available: true as const });
    }
    if (excludeId != null && existing.id === excludeId) {
      return ok({ available: true as const });
    }
    return ok({ available: false as const, reason: "TAKEN" as const });
  } catch (error) {
    return handleRouteError(error);
  }
}
