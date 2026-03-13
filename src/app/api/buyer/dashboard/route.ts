import { NextRequest } from "next/server";
import { Role, ShipmentStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    if (user.role !== Role.BUYER) {
      throw new HttpError(403, "BUYER 대시보드 접근 권한이 없습니다.");
    }

    const [myOrders, paymentPendingOrders, orders] = await Promise.all([
      prisma.order.count({
        where: { buyer_id: user.id },
      }),
      prisma.order.count({
        where: { buyer_id: user.id, buyer_status: "PAYMENT_PENDING" },
      }),
      prisma.order.findMany({
        where: { buyer_id: user.id },
        select: {
          id: true,
          order_no: true,
          created_at: true,
          buyer_status: true,
          status: true,
          _count: {
            select: {
              order_items: true,
            },
          },
          suppliers: {
            include: {
              shipments: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
        orderBy: [{ created_at: "desc" }],
        take: 20,
      }),
    ]);

    const ordersWithShipping = orders.map((order) => {
      const shipmentStatuses = order.suppliers.flatMap((supplierRow) =>
        supplierRow.shipments.map((shipment) => shipment.status),
      );
      let shippingStatus = "PENDING";
      if (order.status === "DELIVERED") {
        shippingStatus = "DELIVERED";
      }
      if (shipmentStatuses.some((status) => status === ShipmentStatus.SHIPPED || status === ShipmentStatus.IN_TRANSIT)) {
        shippingStatus = "IN_PROGRESS";
      }
      if (shipmentStatuses.length > 0 && shipmentStatuses.every((status) => status === ShipmentStatus.DELIVERED)) {
        shippingStatus = "DELIVERED";
      }
      return {
        id: order.id,
        orderNo: order.order_no,
        orderDate: order.created_at,
        productCount: order._count.order_items,
        paymentStatus: order.buyer_status,
        shippingStatus,
      };
    });

    const shippingInProgressOrders = ordersWithShipping.filter(
      (order) => order.shippingStatus === "IN_PROGRESS",
    ).length;
    const deliveredOrders = ordersWithShipping.filter(
      (order) => order.shippingStatus === "DELIVERED",
    ).length;

    return ok({
      metrics: {
        myOrders,
        shippingInProgressOrders,
        deliveredOrders,
        paymentPendingOrders,
      },
      orders: ordersWithShipping,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
