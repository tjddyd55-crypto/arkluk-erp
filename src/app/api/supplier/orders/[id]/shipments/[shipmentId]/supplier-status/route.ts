import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supplierShipmentStatusUpdateSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";
import { updateSupplierShipmentStatus } from "@/server/services/shipment-service";

export async function PATCH(
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

    const body = await request.json().catch(() => ({}));
    const parsed = supplierShipmentStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "배송 상태 변경 요청 형식이 올바르지 않습니다.");
    }

    const updated = await updateSupplierShipmentStatus({
      shipmentId: parsedShipmentId,
      supplierId: user.supplierId,
      userId: user.id,
      status: parsed.data.status,
      statusMessage: parsed.data.statusMessage,
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_UPDATE_SHIPMENT_STATUS",
      targetType: "SHIPMENT",
      targetId: parsedShipmentId,
      afterData: {
        orderId,
        status: parsed.data.status,
      },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
