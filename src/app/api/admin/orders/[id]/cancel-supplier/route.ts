import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { orderSupplierCancelSchema } from "@/lib/schemas";
import { toNumber } from "@/lib/utils";
import { adminCancelSupplierOrder } from "@/server/services/order-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function POST(
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

    const supplierId = toNumber(request.nextUrl.searchParams.get("supplierId"));
    if (!supplierId) {
      throw new HttpError(400, "supplierId가 필요합니다.");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = orderSupplierCancelSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "발주 취소 요청 형식이 올바르지 않습니다.");
    }

    await adminCancelSupplierOrder(orderId, supplierId, user.id, {
      reason: parsed.data.reason ?? null,
    });

    return ok({ orderId, supplierId });
  } catch (error) {
    return handleRouteError(error);
  }
}
