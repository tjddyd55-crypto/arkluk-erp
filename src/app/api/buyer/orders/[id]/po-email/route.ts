import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { emailBuyerOrderCombinedPoPdf } from "@/server/services/order-po-email-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(_request, ["BUYER"]);
    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
    }

    const result = await emailBuyerOrderCombinedPoPdf({ orderId, user });
    if (!result.success) {
      throw new HttpError(502, result.errorMessage ?? "메일 발송에 실패했습니다.");
    }

    return ok({ mocked: result.mocked });
  } catch (error) {
    return handleRouteError(error);
  }
}
