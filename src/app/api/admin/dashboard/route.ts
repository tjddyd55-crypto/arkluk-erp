import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      todayOrders,
      waitingOrders,
      partialOrders,
      recentQuotes,
      recentFailedEmails,
      countries,
      suppliers,
      buyers,
    ] = await Promise.all([
      prisma.order.count({ where: { created_at: { gte: todayStart } } }),
      prisma.order.count({ where: { status: "REVIEWING" } }),
      prisma.order.count({ where: { status: "PARTIAL_SENT" } }),
      prisma.quote.count({
        where: { created_at: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) } },
      }),
      prisma.emailLog.findMany({
        where: { status: "FAILED" },
        orderBy: [{ created_at: "desc" }],
        take: 10,
      }),
      prisma.country.count({ where: { is_active: true } }),
      prisma.supplier.count({ where: { is_active: true } }),
      prisma.user.count({ where: { role: "BUYER", is_active: true } }),
    ]);

    return ok({
      todayOrders,
      waitingOrders,
      partialOrders,
      recentQuotes,
      recentFailedEmails,
      countries,
      suppliers,
      buyers,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
