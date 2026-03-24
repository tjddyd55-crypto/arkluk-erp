import {
  NotificationEvent,
  OrderStatus,
  OrderSupplierStatus,
  Role,
  ShipmentStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createNotification,
  listActiveUserIdsByRoles,
} from "@/server/services/notification-service";

const ORDER_DELAY_HOURS = 24;
const SHIPMENT_DELAY_HOURS = 48;
const ADMIN_NOTIFICATION_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.KOREA_SUPPLY_ADMIN];

export type DelayedOrderRow = {
  id: number;
  orderNo: string;
  countryCode: string;
  countryName: string;
  buyerName: string;
  assignedAt: Date;
  delayedSuppliers: string[];
};

export type DelayedShipmentRow = {
  id: number;
  shipmentNo: string;
  orderId: number;
  orderNo: string;
  supplierName: string;
  shippedAt: Date;
};

function buildOrderDelayThreshold() {
  return new Date(Date.now() - ORDER_DELAY_HOURS * 60 * 60 * 1000);
}

function buildShipmentDelayThreshold() {
  return new Date(Date.now() - SHIPMENT_DELAY_HOURS * 60 * 60 * 1000);
}

function mapDelayedSupplierNames(
  suppliers: Array<{
    supplier: {
      supplier_name: string;
    };
  }>,
) {
  return [...new Set(suppliers.map((row) => row.supplier.supplier_name))];
}

async function fetchDelayedOrderRows(limit?: number) {
  const delayThreshold = buildOrderDelayThreshold();
  return prisma.order.findMany({
    where: {
      status: OrderStatus.ASSIGNED,
      updated_at: { lte: delayThreshold },
      suppliers: {
        some: {
          supplier_confirmed_at: null,
          status: {
            in: [OrderSupplierStatus.PENDING, OrderSupplierStatus.SENT],
          },
        },
      },
    },
    include: {
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
      suppliers: {
        where: {
          supplier_confirmed_at: null,
          status: {
            in: [OrderSupplierStatus.PENDING, OrderSupplierStatus.SENT],
          },
        },
        select: {
          supplier: {
            select: {
              supplier_name: true,
            },
          },
        },
      },
    },
    orderBy: [{ updated_at: "asc" }, { id: "asc" }],
    ...(typeof limit === "number" ? { take: Math.max(1, limit) } : {}),
  });
}

async function fetchDelayedShipmentRows(limit?: number) {
  const delayThreshold = buildShipmentDelayThreshold();
  return prisma.shipment.findMany({
    where: {
      status: {
        in: [ShipmentStatus.SHIPPED, ShipmentStatus.IN_TRANSIT],
      },
      delivered_at: null,
      OR: [
        {
          shipped_at: {
            lte: delayThreshold,
          },
        },
        {
          shipped_at: null,
          created_at: {
            lte: delayThreshold,
          },
        },
      ],
    },
    select: {
      id: true,
      shipment_no: true,
      shipped_at: true,
      created_at: true,
      order_supplier: {
        select: {
          order_id: true,
          order: {
            select: {
              order_no: true,
            },
          },
          supplier: {
            select: {
              supplier_name: true,
            },
          },
        },
      },
    },
    orderBy: [{ shipped_at: "asc" }, { created_at: "asc" }, { id: "asc" }],
    ...(typeof limit === "number" ? { take: Math.max(1, limit) } : {}),
  });
}

export async function countDelayedOrders() {
  const delayThreshold = buildOrderDelayThreshold();
  return prisma.order.count({
    where: {
      status: OrderStatus.ASSIGNED,
      updated_at: { lte: delayThreshold },
      suppliers: {
        some: {
          supplier_confirmed_at: null,
          status: {
            in: [OrderSupplierStatus.PENDING, OrderSupplierStatus.SENT],
          },
        },
      },
    },
  });
}

export async function countDelayedShipments() {
  const delayThreshold = buildShipmentDelayThreshold();
  return prisma.shipment.count({
    where: {
      status: {
        in: [ShipmentStatus.SHIPPED, ShipmentStatus.IN_TRANSIT],
      },
      delivered_at: null,
      OR: [
        {
          shipped_at: {
            lte: delayThreshold,
          },
        },
        {
          shipped_at: null,
          created_at: {
            lte: delayThreshold,
          },
        },
      ],
    },
  });
}

export async function listDelayedOrders(limit = 10): Promise<DelayedOrderRow[]> {
  const rows = await fetchDelayedOrderRows(limit);
  return rows.map((row) => ({
    id: row.id,
    orderNo: row.order_no,
    countryCode: row.country.country_code,
    countryName: row.country.country_name,
    buyerName: row.buyer.name,
    assignedAt: row.updated_at,
    delayedSuppliers: mapDelayedSupplierNames(row.suppliers),
  }));
}

export async function listDelayedShipments(limit = 10): Promise<DelayedShipmentRow[]> {
  const rows = await fetchDelayedShipmentRows(limit);
  return rows.map((row) => ({
    id: row.id,
    shipmentNo: row.shipment_no,
    orderId: row.order_supplier.order_id,
    orderNo: row.order_supplier.order.order_no,
    supplierName: row.order_supplier.supplier.supplier_name,
    shippedAt: row.shipped_at ?? row.created_at,
  }));
}

export async function runOrderMonitoringSweep() {
  const adminUserIds = await listActiveUserIdsByRoles(ADMIN_NOTIFICATION_ROLES);
  if (adminUserIds.length === 0) {
    return {
      delayedOrdersDetected: 0,
      delayedOrdersNotified: 0,
      delayedShipmentsDetected: 0,
      delayedShipmentsNotified: 0,
      skipped: "NO_ADMIN_RECIPIENTS",
    };
  }

  const [delayedOrders, delayedShipments] = await Promise.all([
    fetchDelayedOrderRows(),
    fetchDelayedShipmentRows(),
  ]);

  const delayedOrderIds = delayedOrders.map((row) => row.id);
  const delayedShipmentIds = delayedShipments.map((row) => row.id);

  const [existingOrderNotifications, existingShipmentNotifications] = await Promise.all([
    delayedOrderIds.length > 0
      ? prisma.notification.findMany({
          where: {
            event_type: NotificationEvent.ORDER_DELAYED,
            entity_type: "ORDER",
            entity_id: { in: delayedOrderIds },
          },
          select: { entity_id: true },
          distinct: ["entity_id"],
        })
      : Promise.resolve([]),
    delayedShipmentIds.length > 0
      ? prisma.notification.findMany({
          where: {
            event_type: NotificationEvent.SHIPMENT_DELAYED,
            entity_type: "SHIPMENT",
            entity_id: { in: delayedShipmentIds },
          },
          select: { entity_id: true },
          distinct: ["entity_id"],
        })
      : Promise.resolve([]),
  ]);

  const orderNotifiedSet = new Set(existingOrderNotifications.map((row) => row.entity_id));
  const shipmentNotifiedSet = new Set(existingShipmentNotifications.map((row) => row.entity_id));

  let delayedOrdersNotified = 0;
  for (const order of delayedOrders) {
    if (orderNotifiedSet.has(order.id)) {
      continue;
    }
    const supplierNames = mapDelayedSupplierNames(order.suppliers);
    await createNotification({
      eventType: NotificationEvent.ORDER_DELAYED,
      entityType: "ORDER",
      entityId: order.id,
      message: `[SLA 지연] ${order.order_no} 공급사 미확인 24시간 초과 (${supplierNames.join(", ") || "미확인 공급사"})`,
      recipientUserIds: adminUserIds,
    });
    delayedOrdersNotified += 1;
  }

  let delayedShipmentsNotified = 0;
  for (const shipment of delayedShipments) {
    if (shipmentNotifiedSet.has(shipment.id)) {
      continue;
    }
    await createNotification({
      eventType: NotificationEvent.SHIPMENT_DELAYED,
      entityType: "SHIPMENT",
      entityId: shipment.id,
      message: `[SLA 지연] ${shipment.shipment_no} 배송완료 지연 48시간 초과 (${shipment.order_supplier.order.order_no})`,
      recipientUserIds: adminUserIds,
    });
    delayedShipmentsNotified += 1;
  }

  return {
    delayedOrdersDetected: delayedOrders.length,
    delayedOrdersNotified,
    delayedShipmentsDetected: delayedShipments.length,
    delayedShipmentsNotified,
    skipped: null,
  };
}
