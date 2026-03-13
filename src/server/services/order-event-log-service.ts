import { OrderEventType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type CreateOrderEventLogInput = {
  orderId: number;
  eventType: OrderEventType;
  message: string;
  createdBy: number;
};

export async function createOrderEventLog(
  input: CreateOrderEventLogInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return tx.orderEventLog.create({
    data: {
      order_id: input.orderId,
      event_type: input.eventType,
      message: input.message,
      created_by: input.createdBy,
    },
  });
}
