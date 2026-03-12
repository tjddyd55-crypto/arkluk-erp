import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { toNumber } from "@/lib/utils";
import { sendOrderToSupplier } from "@/server/services/order-service";

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

    await sendOrderToSupplier(orderId, supplierId, user.id);
    return ok({ orderId, supplierId });
  } catch (error) {
    return handleRouteError(error);
  }
}
