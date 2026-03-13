import {
  NotificationEvent,
  OrderEventType,
  Prisma,
  ShipmentStatus,
  SupplierShipmentStatus,
} from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";
import { createOrderEventLog } from "@/server/services/order-event-log-service";

type CreateShipmentInput = {
  carrier?: string | null;
  trackingNumber?: string | null;
};

function normalizeText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildShipmentNo() {
  const now = new Date();
  const yyyymmdd = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  const stamp = String(now.getTime()).slice(-6);
  return `SHP-${yyyymmdd}-${stamp}`;
}

export async function listShipmentsByOrderSupplier(orderSupplierId: number) {
  return prisma.shipment.findMany({
    where: { order_supplier_id: orderSupplierId },
    include: {
      items: {
        include: {
          order_item: {
            select: {
              id: true,
              product_code_snapshot: true,
              product_name_snapshot: true,
              spec_snapshot: true,
              unit_snapshot: true,
              qty: true,
            },
          },
        },
        orderBy: [{ id: "asc" }],
      },
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
  });
}

export async function createShipment(
  orderSupplierId: number,
  userId: number,
  input?: CreateShipmentInput,
) {
  const orderSupplier = await prisma.orderSupplier.findUnique({
    where: { id: orderSupplierId },
    select: { id: true, status: true, order_id: true },
  });
  if (!orderSupplier) {
    throw new HttpError(404, "주문 공급사 정보를 찾을 수 없습니다.");
  }
  if (orderSupplier.status === "CANCELLED") {
    throw new HttpError(400, "취소된 발주에는 출고를 생성할 수 없습니다.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        order_supplier_id: orderSupplierId,
        shipment_no: buildShipmentNo(),
        carrier: normalizeText(input?.carrier),
        tracking_number: normalizeText(input?.trackingNumber),
        status: ShipmentStatus.CREATED,
        supplier_status: SupplierShipmentStatus.CONFIRMED,
        supplier_status_updated_by: userId,
        supplier_status_updated_at: new Date(),
      },
    });
    await createOrderEventLog(
      {
        orderId: orderSupplier.order_id,
        eventType: OrderEventType.SHIPMENT_CREATED,
        message: `출고 생성 (${created.shipment_no})`,
        createdBy: userId,
      },
      tx,
    );
    return created;
  });

  return created;
}

export async function addShipmentItem(shipmentId: number, orderItemId: number, quantity: number) {
  const qty = new Prisma.Decimal(quantity);
  if (qty.lte(0)) {
    throw new HttpError(400, "수량은 0보다 커야 합니다.");
  }

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        order_supplier: {
          select: {
            id: true,
            order_id: true,
            supplier_id: true,
            status: true,
          },
        },
      },
    });
    if (!shipment) {
      throw new HttpError(404, "출고 정보를 찾을 수 없습니다.");
    }
    if (
      shipment.status === ShipmentStatus.DELIVERED ||
      shipment.status === ShipmentStatus.CANCELLED
    ) {
      throw new HttpError(400, "완료/취소된 출고에는 품목을 추가할 수 없습니다.");
    }

    const orderItem = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      select: {
        id: true,
        order_id: true,
        supplier_id: true,
        qty: true,
        status: true,
      },
    });
    if (!orderItem) {
      throw new HttpError(404, "주문 품목을 찾을 수 없습니다.");
    }
    if (
      orderItem.order_id !== shipment.order_supplier.order_id ||
      orderItem.supplier_id !== shipment.order_supplier.supplier_id
    ) {
      throw new HttpError(400, "해당 출고에 포함할 수 없는 주문 품목입니다.");
    }
    if (orderItem.status === "CANCELLED") {
      throw new HttpError(400, "취소된 주문 품목은 출고에 포함할 수 없습니다.");
    }

    const totalQuantityByItem = await tx.shipmentItem.aggregate({
      where: { order_item_id: orderItemId },
      _sum: { quantity: true },
    });
    const alreadyAllocated = totalQuantityByItem._sum.quantity ?? new Prisma.Decimal(0);
    const projectedTotal = alreadyAllocated.add(qty);
    if (projectedTotal.gt(orderItem.qty)) {
      throw new HttpError(
        400,
        `출고 수량이 주문 수량을 초과합니다. (주문:${orderItem.qty.toString()}, 출고예정:${projectedTotal.toString()})`,
      );
    }

    const saved = await tx.shipmentItem.upsert({
      where: {
        shipment_id_order_item_id: {
          shipment_id: shipmentId,
          order_item_id: orderItemId,
        },
      },
      update: {
        quantity: {
          increment: qty,
        },
      },
      create: {
        shipment_id: shipmentId,
        order_item_id: orderItemId,
        quantity: qty,
      },
    });

    return saved;
  });
}

export async function markShipmentShipped(shipmentId: number, userId: number) {
  const txResult = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        status: true,
        order_supplier: {
          select: {
            order_id: true,
            order: {
              select: {
                buyer_id: true,
                order_no: true,
              },
            },
          },
        },
      },
    });
    if (!shipment) {
      throw new HttpError(404, "출고 정보를 찾을 수 없습니다.");
    }
    if (shipment.status !== ShipmentStatus.CREATED) {
      throw new HttpError(400, "CREATED 상태 출고만 출고 처리할 수 있습니다.");
    }

    const itemCount = await tx.shipmentItem.count({
      where: { shipment_id: shipmentId },
    });
    if (itemCount === 0) {
      throw new HttpError(400, "출고 품목이 없는 출고는 처리할 수 없습니다.");
    }

    const updated = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.SHIPPED,
        supplier_status: SupplierShipmentStatus.SHIPPED,
        supplier_status_updated_by: userId,
        supplier_status_updated_at: new Date(),
        shipped_at: new Date(),
      },
    });
    await createOrderEventLog(
      {
        orderId: shipment.order_supplier.order_id,
        eventType: OrderEventType.SHIPMENT_SHIPPED,
        message: `출고 시작 (${updated.shipment_no})`,
        createdBy: userId,
      },
      tx,
    );

    return {
      shipment: updated,
      orderId: shipment.order_supplier.order_id,
      buyerId: shipment.order_supplier.order.buyer_id,
      orderNo: shipment.order_supplier.order.order_no,
    };
  });

  await createNotification({
    eventType: NotificationEvent.SHIPMENT_SHIPPED,
    entityType: "ORDER",
    entityId: txResult.orderId,
    message: `배송이 출고 처리되었습니다. (${txResult.orderNo})`,
    recipientUserIds: [txResult.buyerId],
  });

  return txResult.shipment;
}

export async function markShipmentDelivered(shipmentId: number, userId: number) {
  const txResult = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        status: true,
        shipped_at: true,
        order_supplier: {
          select: {
            order_id: true,
            order: {
              select: {
                buyer_id: true,
                order_no: true,
              },
            },
          },
        },
      },
    });
    if (!shipment) {
      throw new HttpError(404, "출고 정보를 찾을 수 없습니다.");
    }
    if (
      shipment.status !== ShipmentStatus.SHIPPED &&
      shipment.status !== ShipmentStatus.IN_TRANSIT
    ) {
      throw new HttpError(400, "SHIPPED/IN_TRANSIT 상태 출고만 납품 완료 처리할 수 있습니다.");
    }

    const updated = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.DELIVERED,
        supplier_status: SupplierShipmentStatus.DELIVERED,
        supplier_status_updated_by: userId,
        supplier_status_updated_at: new Date(),
        delivered_at: new Date(),
        shipped_at: shipment.shipped_at ?? new Date(),
      },
    });
    await createOrderEventLog(
      {
        orderId: shipment.order_supplier.order_id,
        eventType: OrderEventType.SHIPMENT_DELIVERED,
        message: `배송 완료 (${updated.shipment_no})`,
        createdBy: userId,
      },
      tx,
    );

    return {
      shipment: updated,
      orderId: shipment.order_supplier.order_id,
      buyerId: shipment.order_supplier.order.buyer_id,
      orderNo: shipment.order_supplier.order.order_no,
    };
  });

  await createNotification({
    eventType: NotificationEvent.SHIPMENT_DELIVERED,
    entityType: "ORDER",
    entityId: txResult.orderId,
    message: `배송이 완료되었습니다. (${txResult.orderNo})`,
    recipientUserIds: [txResult.buyerId],
  });

  return txResult.shipment;
}

export async function addShipmentStatus(shipmentId: number, message: string, userId: number) {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) {
    throw new HttpError(400, "상태 메시지를 입력해 주세요.");
  }

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, status: true },
    });
    if (!shipment) {
      throw new HttpError(404, "출고 정보를 찾을 수 없습니다.");
    }
    if (shipment.status === ShipmentStatus.CANCELLED) {
      throw new HttpError(400, "취소된 출고에는 상태 메시지를 추가할 수 없습니다.");
    }

    return tx.shipmentStatusLog.create({
      data: {
        shipment_id: shipmentId,
        status_message: normalizedMessage,
        created_by: userId,
      },
    });
  });
}

type UpdateSupplierShipmentStatusInput = {
  shipmentId: number;
  supplierId: number;
  userId: number;
  status: SupplierShipmentStatus;
  statusMessage?: string | null;
};

function composeShipmentStatusMessage(status: SupplierShipmentStatus, message?: string | null) {
  const base = `[${status}]`;
  const normalizedMessage = normalizeText(message);
  return normalizedMessage ? `${base} ${normalizedMessage}` : `${base} 배송 상태 업데이트`;
}

export async function updateSupplierShipmentStatus(input: UpdateSupplierShipmentStatusInput) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: input.shipmentId },
      select: {
        id: true,
        status: true,
        shipped_at: true,
        delivered_at: true,
        order_supplier: {
          select: {
            supplier_id: true,
            order_id: true,
            order: {
              select: {
                buyer_id: true,
                order_no: true,
              },
            },
          },
        },
      },
    });
    if (!shipment) {
      throw new HttpError(404, "출고 정보를 찾을 수 없습니다.");
    }
    if (shipment.order_supplier.supplier_id !== input.supplierId) {
      throw new HttpError(403, "해당 출고의 상태를 변경할 권한이 없습니다.");
    }
    if (shipment.status === ShipmentStatus.CANCELLED) {
      throw new HttpError(400, "취소된 출고의 상태는 변경할 수 없습니다.");
    }
    if (
      shipment.status === ShipmentStatus.DELIVERED &&
      input.status !== SupplierShipmentStatus.DELIVERED
    ) {
      throw new HttpError(400, "배송 완료된 출고의 상태는 되돌릴 수 없습니다.");
    }

    let nextShipmentStatus = shipment.status;
    let nextShippedAt = shipment.shipped_at;
    let nextDeliveredAt = shipment.delivered_at;

    if (input.status === SupplierShipmentStatus.SHIPPED) {
      nextShipmentStatus = ShipmentStatus.SHIPPED;
      nextShippedAt = shipment.shipped_at ?? new Date();
    } else if (input.status === SupplierShipmentStatus.DELIVERED) {
      nextShipmentStatus = ShipmentStatus.DELIVERED;
      nextDeliveredAt = new Date();
      nextShippedAt = shipment.shipped_at ?? new Date();
    } else if (input.status === SupplierShipmentStatus.HOLD) {
      nextShipmentStatus =
        shipment.status === ShipmentStatus.SHIPPED ? ShipmentStatus.IN_TRANSIT : shipment.status;
    } else if (
      input.status === SupplierShipmentStatus.CONFIRMED ||
      input.status === SupplierShipmentStatus.PREPARING ||
      input.status === SupplierShipmentStatus.PACKING
    ) {
      if (shipment.status !== ShipmentStatus.DELIVERED) {
        nextShipmentStatus = ShipmentStatus.CREATED;
      }
    }

    const updated = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: nextShipmentStatus,
        supplier_status: input.status,
        supplier_status_updated_by: input.userId,
        supplier_status_updated_at: new Date(),
        shipped_at: nextShippedAt,
        delivered_at: nextDeliveredAt,
      },
    });

    const statusMessage = composeShipmentStatusMessage(input.status, input.statusMessage);
    await tx.shipmentStatusLog.create({
      data: {
        shipment_id: shipment.id,
        status_message: statusMessage,
        created_by: input.userId,
      },
    });

    if (nextShipmentStatus === ShipmentStatus.SHIPPED) {
      await createOrderEventLog(
        {
          orderId: shipment.order_supplier.order_id,
          eventType: OrderEventType.SHIPMENT_SHIPPED,
          message: `출고 시작 (${updated.shipment_no})`,
          createdBy: input.userId,
        },
        tx,
      );
      await createNotification({
        eventType: NotificationEvent.SHIPMENT_SHIPPED,
        entityType: "ORDER",
        entityId: shipment.order_supplier.order_id,
        message: `배송이 출고 처리되었습니다. (${shipment.order_supplier.order.order_no})`,
        recipientUserIds: [shipment.order_supplier.order.buyer_id],
      }, tx);
    }

    if (nextShipmentStatus === ShipmentStatus.DELIVERED) {
      await createOrderEventLog(
        {
          orderId: shipment.order_supplier.order_id,
          eventType: OrderEventType.SHIPMENT_DELIVERED,
          message: `배송 완료 (${updated.shipment_no})`,
          createdBy: input.userId,
        },
        tx,
      );
      await createNotification({
        eventType: NotificationEvent.SHIPMENT_DELIVERED,
        entityType: "ORDER",
        entityId: shipment.order_supplier.order_id,
        message: `배송이 완료되었습니다. (${shipment.order_supplier.order.order_no})`,
        recipientUserIds: [shipment.order_supplier.order.buyer_id],
      }, tx);
    }

    return updated;
  });
}
