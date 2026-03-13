import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const order = await prisma.order.findFirst({
      where:
        user.role === Role.COUNTRY_ADMIN
          ? {
              id: orderId,
              country_id: user.countryId!,
            }
          : {
              id: orderId,
              buyer_id: user.id,
            },
      include: {
        country: true,
        buyer: true,
        order_items: true,
        event_logs: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
        },
        suppliers: {
          include: {
            supplier: true,
            shipments: {
              include: {
                status_logs: {
                  include: {
                    creator: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                  orderBy: [{ created_at: "asc" }, { id: "asc" }],
                },
              },
              orderBy: [{ created_at: "desc" }, { id: "desc" }],
            },
          },
        },
      },
    });
    if (!order) {
      throw new HttpError(404, "주문을 찾을 수 없습니다.");
    }
    return ok(order);
  } catch (error) {
    return handleRouteError(error);
  }
}
