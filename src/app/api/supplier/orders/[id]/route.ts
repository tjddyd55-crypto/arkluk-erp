import { NextRequest } from "next/server";
import { OrderItemStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const orderSupplier = await prisma.orderSupplier.findFirst({
      where: {
        order_id: orderId,
        supplier_id: user.supplierId,
      },
      include: {
        order: {
          include: {
            buyer: true,
            country: true,
            order_items: {
              where: { supplier_id: user.supplierId },
              orderBy: [{ id: "asc" }],
            },
          },
        },
      },
    });

    const hasWorkflowItems = Boolean(
      orderSupplier?.order.order_items.some(
        (item) =>
          item.status === OrderItemStatus.ASSIGNED ||
          item.status === OrderItemStatus.SUPPLIER_CONFIRMED ||
          item.status === OrderItemStatus.SHIPPED ||
          item.status === OrderItemStatus.DELIVERED,
      ),
    );

    if (!orderSupplier || (!orderSupplier.portal_visible && !hasWorkflowItems)) {
      throw new HttpError(404, "주문을 찾을 수 없습니다.");
    }

    return ok(orderSupplier);
  } catch (error) {
    return handleRouteError(error);
  }
}
