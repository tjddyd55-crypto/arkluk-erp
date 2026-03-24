import { NextRequest } from "next/server";
import { OrderSupplierStatus, ShipmentStatus, SupplierShipmentStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const [myOrders, preparingOrders, shippingOrders, completedOrders, orderRows, shipmentTargets, recentLogs] =
      await Promise.all([
        prisma.orderSupplier.count({
          where: { supplier_id: user.supplierId },
        }),
        prisma.orderSupplier.count({
          where: {
            supplier_id: user.supplierId,
            status: {
              in: [OrderSupplierStatus.SENT, OrderSupplierStatus.CONFIRMED],
            },
          },
        }),
        prisma.orderSupplier.count({
          where: {
            supplier_id: user.supplierId,
            status: OrderSupplierStatus.SHIPPING,
          },
        }),
        prisma.orderSupplier.count({
          where: {
            supplier_id: user.supplierId,
            status: OrderSupplierStatus.COMPLETED,
          },
        }),
        prisma.orderSupplier.findMany({
          where: { supplier_id: user.supplierId },
          select: {
            id: true,
            status: true,
            order: {
              select: {
                id: true,
                order_no: true,
                buyer: {
                  select: {
                    name: true,
                  },
                },
                order_items: {
                  where: {
                    supplier_id: user.supplierId,
                  },
                  select: {
                    id: true,
                  },
                },
              },
            },
            shipments: {
              orderBy: [{ created_at: "desc" }],
              take: 1,
              select: {
                supplier_status: true,
              },
            },
          },
          orderBy: [{ created_at: "desc" }],
          take: 20,
        }),
        prisma.shipment.findMany({
          where: {
            order_supplier: {
              supplier_id: user.supplierId,
            },
          },
          select: {
            id: true,
            shipment_no: true,
            supplier_status: true,
            status: true,
            order_supplier: {
              select: {
                order_id: true,
                order: {
                  select: {
                    order_no: true,
                  },
                },
              },
            },
          },
          orderBy: [{ created_at: "desc" }],
          take: 20,
        }),
        prisma.shipmentStatusLog.findMany({
          where: {
            shipment: {
              order_supplier: {
                supplier_id: user.supplierId,
              },
            },
          },
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          take: 20,
          select: {
            id: true,
            created_at: true,
            status_message: true,
            shipment: {
              select: {
                shipment_no: true,
              },
            },
          },
        }),
      ]);

    const orders = orderRows.map((row) => ({
      orderId: row.order.id,
      orderNo: row.order.order_no,
      buyerName: row.order.buyer.name,
      productCount: row.order.order_items.length,
      orderStatus: row.status,
      shippingStatus: row.shipments[0]?.supplier_status ?? "N/A",
    }));

    return ok({
      metrics: {
        myOrders,
        preparingOrders,
        shippingOrders,
        completedOrders,
      },
      orders,
      shipmentTargets: shipmentTargets.map((row) => ({
        shipmentId: row.id,
        shipmentNo: row.shipment_no,
        orderId: row.order_supplier.order_id,
        orderNo: row.order_supplier.order.order_no,
        shipmentStatus: row.status,
        supplierStatus: row.supplier_status,
      })),
      recentLogs: recentLogs.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        message: row.status_message,
        shipmentNo: row.shipment.shipment_no,
      })),
      supplierShipmentStatusOptions: [
        SupplierShipmentStatus.CONFIRMED,
        SupplierShipmentStatus.PREPARING,
        SupplierShipmentStatus.PACKING,
        SupplierShipmentStatus.SHIPPED,
        SupplierShipmentStatus.DELIVERED,
        SupplierShipmentStatus.HOLD,
      ],
      shipmentStatusOptions: [
        ShipmentStatus.CREATED,
        ShipmentStatus.SHIPPED,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.CANCELLED,
      ],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
