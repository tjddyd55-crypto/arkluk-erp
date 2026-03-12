import { OrderStatus, OrderSupplierStatus, Prisma, Role } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildDocumentNo } from "@/lib/utils";
import { createAuditLog } from "@/server/services/audit-log";

type CreateOrderInput = {
  buyerId: number;
  projectId?: number | null;
  memo?: string | null;
  items: Array<{
    productId: number;
    qty: number;
    memo?: string | null;
  }>;
};

type UpdateOrderInput = {
  actorId: number;
  status?: "PENDING" | "REVIEWING";
  operations: Array<
    | {
        actionType: "UPDATE_QTY";
        orderItemId: number;
        qty: number;
      }
    | {
        actionType: "DELETE_ITEM";
        orderItemId: number;
      }
    | {
        actionType: "ADD_ITEM";
        productId: number;
        qty: number;
        memo?: string | null;
      }
  >;
};

function calcAmount(price: Prisma.Decimal, qty: number) {
  return price.mul(new Prisma.Decimal(qty));
}

export async function createOrder(input: CreateOrderInput) {
  const buyer = await prisma.user.findUnique({
    where: { id: input.buyerId },
  });

  if (!buyer || !buyer.is_active || buyer.role !== Role.BUYER || !buyer.country_id) {
    throw new HttpError(400, "유효한 바이어 계정이 아닙니다.");
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, is_active: true },
    include: { category: true, supplier: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  if (products.length !== productIds.length) {
    throw new HttpError(400, "주문 대상 상품 중 유효하지 않은 상품이 있습니다.");
  }

  const orderNo = buildDocumentNo("ORD");

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        order_no: orderNo,
        buyer_id: buyer.id,
        country_id: buyer.country_id!,
        project_id: input.projectId ?? null,
        memo: input.memo ?? null,
        status: OrderStatus.PENDING,
      },
    });

    const supplierIds = new Set<number>();

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new HttpError(400, `상품을 찾을 수 없습니다. (${item.productId})`);
      }

      supplierIds.add(product.supplier_id);

      await tx.orderItem.create({
        data: {
          order_id: order.id,
          supplier_id: product.supplier_id,
          category_id: product.category_id,
          product_id: product.id,
          product_code_snapshot: product.product_code,
          product_name_snapshot: product.product_name,
          spec_snapshot: product.spec,
          unit_snapshot: product.unit,
          price_snapshot: product.price,
          qty: new Prisma.Decimal(item.qty),
          amount: calcAmount(product.price, item.qty),
          memo: item.memo ?? null,
        },
      });
    }

    await tx.orderSupplier.createMany({
      data: [...supplierIds].map((supplierId) => ({
        order_id: order.id,
        supplier_id: supplierId,
        status: OrderSupplierStatus.WAITING,
      })),
      skipDuplicates: true,
    });

    await createAuditLog(
      {
        actorId: buyer.id,
        actionType: "CREATE_ORDER",
        targetType: "ORDER",
        targetId: order.id,
        afterData: {
          orderNo: order.order_no,
          itemCount: input.items.length,
          supplierCount: supplierIds.size,
        },
      },
      tx,
    );

    return order;
  });
}

function ensureEditableBySupplierStatus(
  supplierStatusMap: Map<number, { status: OrderSupplierStatus }>,
  supplierId: number,
) {
  const supplierStatus = supplierStatusMap.get(supplierId);
  if (!supplierStatus) {
    throw new HttpError(400, "공급사 발송 상태를 확인할 수 없습니다.");
  }

  if (supplierStatus.status === OrderSupplierStatus.SENT) {
    throw new HttpError(400, "이미 발송된 공급사 항목은 수정할 수 없습니다.");
  }
}

export async function updateOrder(orderId: number, input: UpdateOrderInput) {
  const currentOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      order_items: true,
      suppliers: true,
    },
  });

  if (!currentOrder) {
    throw new HttpError(404, "주문을 찾을 수 없습니다.");
  }

  if (
    currentOrder.status === OrderStatus.SENT ||
    currentOrder.status === OrderStatus.CANCELLED
  ) {
    throw new HttpError(400, "완료/취소된 주문은 수정할 수 없습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const supplierStatusMap = new Map(
      currentOrder.suppliers.map((supplier) => [supplier.supplier_id, supplier]),
    );

    for (const operation of input.operations) {
      if (operation.actionType === "UPDATE_QTY") {
        const orderItem = await tx.orderItem.findUnique({
          where: { id: operation.orderItemId },
        });
        if (!orderItem || orderItem.order_id !== orderId) {
          throw new HttpError(404, "수정 대상 주문 품목을 찾을 수 없습니다.");
        }
        ensureEditableBySupplierStatus(supplierStatusMap, orderItem.supplier_id);

        const beforeQty = orderItem.qty;
        const beforeAmount = orderItem.amount;
        const qty = new Prisma.Decimal(operation.qty);
        const amount = orderItem.price_snapshot.mul(qty);

        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: { qty, amount },
        });
        await tx.orderChangeLog.create({
          data: {
            order_id: orderId,
            order_item_id: orderItem.id,
            action_type: "UPDATE_QTY",
            before_data: {
              qty: beforeQty.toString(),
              amount: beforeAmount.toString(),
            },
            after_data: {
              qty: qty.toString(),
              amount: amount.toString(),
            },
            changed_by: input.actorId,
          },
        });
      }

      if (operation.actionType === "DELETE_ITEM") {
        const orderItem = await tx.orderItem.findUnique({
          where: { id: operation.orderItemId },
        });
        if (!orderItem || orderItem.order_id !== orderId) {
          throw new HttpError(404, "삭제 대상 주문 품목을 찾을 수 없습니다.");
        }
        ensureEditableBySupplierStatus(supplierStatusMap, orderItem.supplier_id);

        await tx.orderItem.delete({ where: { id: orderItem.id } });
        await tx.orderChangeLog.create({
          data: {
            order_id: orderId,
            order_item_id: orderItem.id,
            action_type: "DELETE_ITEM",
            before_data: {
              productId: orderItem.product_id,
              qty: orderItem.qty.toString(),
            },
            after_data: {},
            changed_by: input.actorId,
          },
        });
      }

      if (operation.actionType === "ADD_ITEM") {
        const product = await tx.product.findUnique({
          where: { id: operation.productId },
        });
        if (!product || !product.is_active) {
          throw new HttpError(400, "추가 대상 상품이 유효하지 않습니다.");
        }
        ensureEditableBySupplierStatus(supplierStatusMap, product.supplier_id);

        const qty = new Prisma.Decimal(operation.qty);
        const created = await tx.orderItem.create({
          data: {
            order_id: orderId,
            supplier_id: product.supplier_id,
            category_id: product.category_id,
            product_id: product.id,
            product_code_snapshot: product.product_code,
            product_name_snapshot: product.product_name,
            spec_snapshot: product.spec,
            unit_snapshot: product.unit,
            price_snapshot: product.price,
            qty,
            amount: product.price.mul(qty),
            memo: operation.memo ?? null,
          },
        });

        await tx.orderChangeLog.create({
          data: {
            order_id: orderId,
            order_item_id: created.id,
            action_type: "ADD_ITEM",
            before_data: {},
            after_data: {
              productId: product.id,
              qty: qty.toString(),
            },
            changed_by: input.actorId,
          },
        });
      }
    }

    const latestItems = await tx.orderItem.findMany({
      where: { order_id: orderId },
      select: { supplier_id: true },
    });

    if (latestItems.length === 0) {
      throw new HttpError(400, "주문에는 최소 1개 이상의 품목이 필요합니다.");
    }

    const latestSupplierIds = new Set(latestItems.map((item) => item.supplier_id));

    const existingSuppliers = await tx.orderSupplier.findMany({
      where: { order_id: orderId },
    });

    for (const orderSupplier of existingSuppliers) {
      if (!latestSupplierIds.has(orderSupplier.supplier_id)) {
        if (orderSupplier.status === OrderSupplierStatus.SENT) {
          throw new HttpError(400, "이미 발송된 공급사 섹션은 삭제할 수 없습니다.");
        }
        await tx.orderSupplier.delete({ where: { id: orderSupplier.id } });
      }
    }

    for (const supplierId of latestSupplierIds) {
      const exists = existingSuppliers.some((supplier) => supplier.supplier_id === supplierId);
      if (!exists) {
        await tx.orderSupplier.create({
          data: {
            order_id: orderId,
            supplier_id: supplierId,
            status: OrderSupplierStatus.WAITING,
          },
        });
      }
    }

    const nextStatus = input.status ? OrderStatus[input.status] : currentOrder.status;
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
    });

    await createAuditLog(
      {
        actorId: input.actorId,
        actionType: "UPDATE_ORDER",
        targetType: "ORDER",
        targetId: orderId,
        beforeData: { status: currentOrder.status },
        afterData: { status: updated.status },
      },
      tx,
    );

    return updated;
  });
}

async function syncOrderStatus(orderId: number, tx: Prisma.TransactionClient) {
  const suppliers = await tx.orderSupplier.findMany({
    where: { order_id: orderId },
    select: { status: true },
  });

  if (suppliers.length === 0) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PENDING },
    });
    return;
  }

  const sentCount = suppliers.filter((supplier) => supplier.status === OrderSupplierStatus.SENT).length;
  const nextStatus =
    sentCount === 0
      ? OrderStatus.REVIEWING
      : sentCount === suppliers.length
        ? OrderStatus.SENT
        : OrderStatus.PARTIAL_SENT;

  await tx.order.update({
    where: { id: orderId },
    data: { status: nextStatus },
  });
}

export async function sendOrderToSupplier(orderId: number, supplierId: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const orderSupplier = await tx.orderSupplier.findUnique({
      where: {
        order_id_supplier_id: { order_id: orderId, supplier_id: supplierId },
      },
      include: { supplier: true },
    });

    if (!orderSupplier) {
      throw new HttpError(404, "발송 대상 공급사 주문을 찾을 수 없습니다.");
    }
    if (orderSupplier.status === OrderSupplierStatus.SENT) {
      throw new HttpError(400, "이미 발송된 공급사입니다.");
    }

    await tx.orderSupplier.update({
      where: { id: orderSupplier.id },
      data: {
        status: OrderSupplierStatus.SENT,
        sent_at: new Date(),
        sent_by: actorId,
        email_sent: true,
        portal_visible: true,
      },
    });

    await tx.emailLog.create({
      data: {
        related_type: "ORDER",
        related_id: orderId,
        supplier_id: supplierId,
        to_email: orderSupplier.supplier.order_email,
        cc_email: orderSupplier.supplier.cc_email,
        subject: `[ARKLUK] 주문 발송 - ${orderId}`,
        body_preview: "관리자 검토 완료 주문이 발송되었습니다.",
        status: "SUCCESS",
        sent_at: new Date(),
      },
    });

    await syncOrderStatus(orderId, tx);
    await createAuditLog(
      {
        actorId,
        actionType: "SEND_SUPPLIER_ORDER",
        targetType: "ORDER",
        targetId: orderId,
        afterData: { supplierId },
      },
      tx,
    );
  });
}

export async function sendOrderToAll(orderId: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const waitingSuppliers = await tx.orderSupplier.findMany({
      where: {
        order_id: orderId,
        status: OrderSupplierStatus.WAITING,
      },
      include: { supplier: true },
    });

    if (waitingSuppliers.length === 0) {
      throw new HttpError(400, "발송 가능한 공급사가 없습니다.");
    }

    for (const supplier of waitingSuppliers) {
      await tx.orderSupplier.update({
        where: { id: supplier.id },
        data: {
          status: OrderSupplierStatus.SENT,
          sent_at: new Date(),
          sent_by: actorId,
          email_sent: true,
          portal_visible: true,
        },
      });
      await tx.emailLog.create({
        data: {
          related_type: "ORDER",
          related_id: orderId,
          supplier_id: supplier.supplier_id,
          to_email: supplier.supplier.order_email,
          cc_email: supplier.supplier.cc_email,
          subject: `[ARKLUK] 주문 일괄 발송 - ${orderId}`,
          body_preview: "관리자 일괄 발송으로 주문이 전달되었습니다.",
          status: "SUCCESS",
          sent_at: new Date(),
        },
      });
    }

    await syncOrderStatus(orderId, tx);
    await createAuditLog(
      {
        actorId,
        actionType: "SEND_SUPPLIER_ORDER_ALL",
        targetType: "ORDER",
        targetId: orderId,
      },
      tx,
    );
  });
}

export async function supplierCheckOrder(orderId: number, supplierId: number, actorId: number) {
  const orderSupplier = await prisma.orderSupplier.findUnique({
    where: { order_id_supplier_id: { order_id: orderId, supplier_id: supplierId } },
  });

  if (!orderSupplier) {
    throw new HttpError(404, "주문 공급사 상태를 찾을 수 없습니다.");
  }

  if (orderSupplier.status !== OrderSupplierStatus.SENT) {
    throw new HttpError(400, "아직 발송되지 않은 주문입니다.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderSupplier.update({
      where: { id: orderSupplier.id },
      data: {
        supplier_checked: true,
        supplier_checked_at: new Date(),
        supplier_checked_by: actorId,
      },
    });

    await createAuditLog(
      {
        actorId,
        actionType: "SUPPLIER_CONFIRM_ORDER",
        targetType: "ORDER",
        targetId: orderId,
        afterData: { supplierId },
      },
      tx,
    );
  });
}
