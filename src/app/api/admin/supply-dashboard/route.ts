import { NextRequest } from "next/server";
import { OrderSupplierStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { countDelayedOrders } from "@/server/services/order-monitoring-service";

const SUPPLY_ADMIN_ROLES = ["KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...SUPPLY_ADMIN_ROLES]);
    const recentLogThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

    const [
      totalSupplierOrders,
      shippingInProgressOrders,
      waitingShipmentOrders,
      delayedOrders,
      supplierOrderGroups,
      supplierShippingGroups,
      supplierCompletedGroups,
      recentSupplierActivities,
    ] = await Promise.all([
      prisma.orderSupplier.count(),
      prisma.orderSupplier.count({
        where: {
          status: {
            in: [OrderSupplierStatus.CONFIRMED, OrderSupplierStatus.SHIPPING],
          },
        },
      }),
      prisma.orderSupplier.count({
        where: {
          status: {
            in: [OrderSupplierStatus.PENDING, OrderSupplierStatus.SENT],
          },
        },
      }),
      countDelayedOrders(),
      prisma.orderSupplier.groupBy({
        by: ["supplier_id"],
        _count: { _all: true },
      }),
      prisma.orderSupplier.groupBy({
        by: ["supplier_id"],
        where: {
          status: {
            in: [OrderSupplierStatus.CONFIRMED, OrderSupplierStatus.SHIPPING],
          },
        },
        _count: { _all: true },
      }),
      prisma.orderSupplier.groupBy({
        by: ["supplier_id"],
        where: {
          status: OrderSupplierStatus.COMPLETED,
        },
        _count: { _all: true },
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

    const supplierIds = supplierOrderGroups.map((row) => row.supplier_id);
    const suppliers = await prisma.supplier.findMany({
      where: {
        id: { in: supplierIds },
      },
      select: {
        id: true,
        supplier_name: true,
      },
    });
    const supplierMap = new Map(suppliers.map((row) => [row.id, row]));
    const shippingMap = new Map(
      supplierShippingGroups.map((row) => [row.supplier_id, row._count._all]),
    );
    const completedMap = new Map(
      supplierCompletedGroups.map((row) => [row.supplier_id, row._count._all]),
    );

    const supplierOrderStats = supplierOrderGroups
      .map((row) => ({
        supplierId: row.supplier_id,
        supplierName: supplierMap.get(row.supplier_id)?.supplier_name ?? `Supplier#${row.supplier_id}`,
        orderCount: row._count._all,
        shippingInProgress: shippingMap.get(row.supplier_id) ?? 0,
        completed: completedMap.get(row.supplier_id) ?? 0,
      }))
      .sort((a, b) => b.orderCount - a.orderCount);

    return ok({
      metrics: {
        totalSupplierOrders,
        shippingInProgressOrders,
        waitingShipmentOrders,
        delayedOrders,
      },
      supplierOrderStats,
      recentSupplierActivities: recentSupplierActivities.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        supplierName: row.shipment.order_supplier.supplier.supplier_name,
        message: row.status_message,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
