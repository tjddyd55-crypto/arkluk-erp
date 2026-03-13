import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { shipmentCreateSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";
import { createShipment, listShipmentsByOrderSupplier } from "@/server/services/shipment-service";

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

    const orderSupplier = await prisma.orderSupplier.findUnique({
      where: {
        order_id_supplier_id: {
          order_id: orderId,
          supplier_id: user.supplierId,
        },
      },
      select: {
        id: true,
      },
    });
    if (!orderSupplier) {
      throw new HttpError(404, "주문 공급사 정보를 찾을 수 없습니다.");
    }

    const shipments = await listShipmentsByOrderSupplier(orderSupplier.id);
    return ok(shipments);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
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

    const orderSupplier = await prisma.orderSupplier.findUnique({
      where: {
        order_id_supplier_id: {
          order_id: orderId,
          supplier_id: user.supplierId,
        },
      },
      select: {
        id: true,
      },
    });
    if (!orderSupplier) {
      throw new HttpError(404, "주문 공급사 정보를 찾을 수 없습니다.");
    }

    const parsed = shipmentCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HttpError(400, "출고 생성 요청 형식이 올바르지 않습니다.");
    }

    const shipment = await createShipment(orderSupplier.id, user.id, parsed.data);
    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_CREATE_SHIPMENT",
      targetType: "SHIPMENT",
      targetId: shipment.id,
      afterData: {
        orderId,
        orderSupplierId: orderSupplier.id,
        shipmentNo: shipment.shipment_no,
      },
    });

    return ok(shipment, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
