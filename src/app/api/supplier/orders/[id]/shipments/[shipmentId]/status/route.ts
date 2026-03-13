import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { shipmentStatusAddSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";
import { addShipmentStatus } from "@/server/services/shipment-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shipmentId: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id, shipmentId } = await params;
    const orderId = Number(id);
    const parsedShipmentId = Number(shipmentId);
    if (Number.isNaN(orderId) || Number.isNaN(parsedShipmentId)) {
      throw new HttpError(400, "유효하지 않은 요청 ID입니다.");
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: parsedShipmentId },
      include: {
        order_supplier: {
          select: {
            order_id: true,
            supplier_id: true,
          },
        },
      },
    });
    if (
      !shipment ||
      shipment.order_supplier.order_id !== orderId ||
      shipment.order_supplier.supplier_id !== user.supplierId
    ) {
      throw new HttpError(404, "출고 정보를 찾을 수 없습니다.");
    }

    const parsed = shipmentStatusAddSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "출고 상태 업데이트 요청 형식이 올바르지 않습니다.");
    }

    const saved = await addShipmentStatus(parsedShipmentId, parsed.data.statusMessage, user.id);
    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_ADD_SHIPMENT_STATUS",
      targetType: "SHIPMENT",
      targetId: parsedShipmentId,
      afterData: {
        orderId,
        statusMessage: saved.status_message,
      },
    });

    return ok(saved, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
