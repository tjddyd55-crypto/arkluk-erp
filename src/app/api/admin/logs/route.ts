import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const type = request.nextUrl.searchParams.get("type");
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
    const take = Number.isNaN(limit) ? 50 : Math.min(Math.max(limit, 1), 200);

    if (!type || type === "audit") {
      const auditLogs = await prisma.auditLog.findMany({
        include: { actor: true },
        orderBy: [{ created_at: "desc" }],
        take,
      });
      return ok({ type: "audit", logs: auditLogs });
    }

    if (type === "email") {
      const emailLogs = await prisma.emailLog.findMany({
        include: { supplier: true },
        orderBy: [{ created_at: "desc" }],
        take,
      });
      return ok({ type: "email", logs: emailLogs });
    }

    if (type === "order-change") {
      const changeLogs = await prisma.orderChangeLog.findMany({
        include: { changed_user: true, order: true },
        orderBy: [{ created_at: "desc" }],
        take,
      });
      return ok({ type: "order-change", logs: changeLogs });
    }

    throw new HttpError(400, "지원하지 않는 로그 타입입니다.");
  } catch (error) {
    return handleRouteError(error);
  }
}
