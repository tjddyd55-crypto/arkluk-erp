import { NextRequest } from "next/server";
import { OrderStatus, Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.UNDER_REVIEW,
        buyer: {
          role: Role.COUNTRY_ADMIN,
        },
      },
      include: {
        buyer: {
          select: { id: true, name: true, role: true },
        },
        country: {
          select: { id: true, country_code: true, country_name: true },
        },
        order_items: {
          include: {
            supplier: {
              select: { id: true, supplier_name: true },
            },
          },
          orderBy: [{ id: "asc" }],
        },
      },
      orderBy: [{ created_at: "desc" }],
    });

    return ok(orders);
  } catch (error) {
    return handleRouteError(error);
  }
}
