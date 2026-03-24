import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { emailBuyerOrderSupplierPoPdf } from "@/server/services/order-po-email-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; orderSupplierId: string }> },
) {
  try {
    const user = await requireAuth(_request, ["BUYER"]);
    const { id, orderSupplierId: sid } = await params;
    const orderId = Number(id);
    const orderSupplierId = Number(sid);
    if (Number.isNaN(orderId) || Number.isNaN(orderSupplierId)) {
      throw new HttpError(400, "유효하지 않은 ID입니다.");
    }

    const result = await emailBuyerOrderSupplierPoPdf({
      orderId,
      orderSupplierId,
      user,
    });
    if (!result.success) {
      throw new HttpError(502, result.errorMessage ?? "메일 발송에 실패했습니다.");
    }

    return ok({ mocked: result.mocked });
  } catch (error) {
    return handleRouteError(error);
  }
}
