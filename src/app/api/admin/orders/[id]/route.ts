import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateOrderSchema } from "@/lib/schemas";
import { updateOrder } from "@/server/services/order-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        country: true,
        project: true,
        order_items: {
          include: { supplier: true, category: true, product: true },
          orderBy: [{ supplier_id: "asc" }, { id: "asc" }],
        },
        suppliers: {
          include: { supplier: true, sender: true, checker: true },
          orderBy: [{ supplier_id: "asc" }],
        },
        change_logs: {
          orderBy: [{ created_at: "desc" }],
          take: 50,
        },
        tax_invoices: {
          include: {
            supplier: true,
            email_inbox: true,
            files: true,
          },
          orderBy: [{ created_at: "desc" }],
        },
      },
    });
    if (!order) {
      throw new HttpError(404, "주문을 찾을 수 없습니다.");
    }
    return ok(order);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const body = await request.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "주문 수정 요청 형식이 올바르지 않습니다.");
    }

    const updated = await updateOrder(orderId, {
      actorId: user.id,
      status: parsed.data.status,
      operations: parsed.data.operations,
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
