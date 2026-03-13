import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["SUPER_ADMIN"]);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const recentLogThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

    const [
      totalOrders,
      ordersToday,
      shippingInProgress,
      deliveredOrders,
      orderStatusGroups,
      recentOrders,
      recentShipmentStatusLogs,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: {
          created_at: { gte: todayStart },
        },
      }),
      prisma.order.count({
        where: {
          status: {
            in: [OrderStatus.SUPPLIER_CONFIRMED, OrderStatus.SHIPPED],
          },
        },
      }),
      prisma.order.count({
        where: {
          status: OrderStatus.DELIVERED,
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: {
          status: {
            in: [
              OrderStatus.CREATED,
              OrderStatus.UNDER_REVIEW,
              OrderStatus.ASSIGNED,
              OrderStatus.SUPPLIER_CONFIRMED,
              OrderStatus.SHIPPED,
              OrderStatus.DELIVERED,
            ],
          },
        },
        _count: { _all: true },
      }),
      prisma.order.findMany({
        orderBy: [{ created_at: "desc" }],
        take: 10,
        select: {
          id: true,
          order_no: true,
          status: true,
          created_at: true,
          country: {
            select: {
              country_code: true,
              country_name: true,
            },
          },
          buyer: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.shipmentStatusLog.findMany({
        where: {
          created_at: { gte: recentLogThreshold },
        },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          created_at: true,
          status_message: true,
          shipment: {
            select: {
              order_supplier: {
                select: {
                  supplier: {
                    select: {
                      supplier_name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const orderStatusStats = {
      CREATED: 0,
      UNDER_REVIEW: 0,
      ASSIGNED: 0,
      SUPPLIER_CONFIRMED: 0,
      SHIPPED: 0,
      DELIVERED: 0,
    };
    for (const row of orderStatusGroups) {
      if (row.status === OrderStatus.CREATED) orderStatusStats.CREATED = row._count._all;
      if (row.status === OrderStatus.UNDER_REVIEW) orderStatusStats.UNDER_REVIEW = row._count._all;
      if (row.status === OrderStatus.ASSIGNED) orderStatusStats.ASSIGNED = row._count._all;
      if (row.status === OrderStatus.SUPPLIER_CONFIRMED) {
        orderStatusStats.SUPPLIER_CONFIRMED = row._count._all;
      }
      if (row.status === OrderStatus.SHIPPED) orderStatusStats.SHIPPED = row._count._all;
      if (row.status === OrderStatus.DELIVERED) orderStatusStats.DELIVERED = row._count._all;
    }

    return ok({
      metrics: {
        totalOrders,
        ordersToday,
        shippingInProgress,
        deliveredOrders,
      },
      orderStatusStats,
      recentOrders,
      recentShipmentStatusLogs: recentShipmentStatusLogs.map((log) => ({
        id: log.id,
        createdAt: log.created_at,
        supplierName: log.shipment.order_supplier.supplier.supplier_name,
        message: log.status_message,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
