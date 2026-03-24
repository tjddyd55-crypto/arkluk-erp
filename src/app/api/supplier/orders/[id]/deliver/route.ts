import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { supplierMarkDelivered } from "@/server/services/order-service";

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

    const body = (await request.json().catch(() => ({}))) as {
      supplierNote?: string | null;
    };

    await supplierMarkDelivered(orderId, user.supplierId, user.id, {
      supplierNote: body.supplierNote ?? null,
    });

    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
