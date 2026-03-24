import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { supplierMarkOrderViewed } from "@/server/services/order-service";

/** 발주서 화면 열람: SENT → VIEWED */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(_request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const result = await supplierMarkOrderViewed(orderId, user.supplierId, user.id);

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
