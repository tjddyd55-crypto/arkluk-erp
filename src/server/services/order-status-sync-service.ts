import { OrderStatus, OrderSupplierStatus, Prisma } from "@prisma/client";

/**
 * 모든 OrderSupplier.status를 집계해 상위 Order.status를 맞춘다.
 * (주문 = 계약, 공급사 구간 = 실행 단위)
 */
export async function syncOrderAggregateStatus(
  orderId: number,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const suppliers = await tx.orderSupplier.findMany({
    where: { order_id: orderId },
    select: { status: true },
  });

  if (suppliers.length === 0) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CREATED },
    });
    return;
  }

  const st = suppliers.map((s) => s.status);

  if (st.every((s) => s === OrderSupplierStatus.REJECTED)) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });
    return;
  }

  if (st.every((s) => s === OrderSupplierStatus.COMPLETED)) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DELIVERED },
    });
    return;
  }

  if (st.some((s) => s === OrderSupplierStatus.SHIPPING)) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.SHIPPED },
    });
    return;
  }

  const atLeastConfirmed: OrderSupplierStatus[] = [
    OrderSupplierStatus.CONFIRMED,
    OrderSupplierStatus.SHIPPING,
    OrderSupplierStatus.COMPLETED,
  ];
  if (st.every((s) => atLeastConfirmed.includes(s))) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.SUPPLIER_CONFIRMED },
    });
    return;
  }

  const postEmail: OrderSupplierStatus[] = [
    OrderSupplierStatus.SENT,
    OrderSupplierStatus.VIEWED,
    OrderSupplierStatus.CONFIRMED,
    OrderSupplierStatus.SHIPPING,
    OrderSupplierStatus.COMPLETED,
    OrderSupplierStatus.REJECTED,
    OrderSupplierStatus.CANCELLED,
  ];
  if (st.some((s) => postEmail.includes(s))) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.ASSIGNED },
    });
    return;
  }

  await tx.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CREATED },
  });
}
