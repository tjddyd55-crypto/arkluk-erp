import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { supplierDeliveryUpdateSchema } from "@/lib/schemas";
import { supplierSetDeliveryDate } from "@/server/services/order-service";

export async function PATCH(
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

    const body = await request.json();
    const parsed = supplierDeliveryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "납기 입력 형식이 올바르지 않습니다.");
    }

    await supplierSetDeliveryDate(orderId, user.supplierId, user.id, {
      expectedDeliveryDate: parsed.data.expectedDeliveryDate,
      supplierNote: parsed.data.supplierNote ?? null,
    });

    return ok({ orderId });
  } catch (error) {
    return handleRouteError(error);
  }
}
