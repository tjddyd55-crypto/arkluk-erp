import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const countryId = toNumber(request.nextUrl.searchParams.get("countryId"));
    const buyerId = toNumber(request.nextUrl.searchParams.get("buyerId"));
    const status = request.nextUrl.searchParams.get("status");
    const orderNo = request.nextUrl.searchParams.get("orderNo")?.trim();

    const where: Prisma.OrderWhereInput = {
      ...(countryId ? { country_id: countryId } : {}),
      ...(buyerId ? { buyer_id: buyerId } : {}),
      ...(status ? { status: status as Prisma.EnumOrderStatusFilter["equals"] } : {}),
      ...(orderNo ? { order_no: { contains: orderNo, mode: "insensitive" } } : {}),
    };

    const orders = await prisma.order.findMany({
      where,
      include: {
        buyer: true,
        country: true,
        suppliers: {
          include: {
            supplier: true,
          },
        },
      },
      orderBy: [{ created_at: "desc" }],
    });

    return ok(orders);
  } catch (error) {
    return handleRouteError(error);
  }
}
