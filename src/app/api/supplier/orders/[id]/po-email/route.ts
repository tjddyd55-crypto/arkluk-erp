import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { emailStaffOrderSupplierPoPdf } from "@/server/services/order-po-email-service";

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

    const os = await prisma.orderSupplier.findFirst({
      where: { order_id: orderId, supplier_id: user.supplierId },
      select: { id: true },
    });
    if (!os) {
      throw new HttpError(404, "공급사 주문 구간을 찾을 수 없습니다.");
    }

    const result = await emailStaffOrderSupplierPoPdf({
      orderId,
      orderSupplierId: os.id,
      staffUserId: user.id,
    });
    if (!result.success) {
      throw new HttpError(502, result.errorMessage ?? "메일 발송에 실패했습니다.");
    }

    return ok({ mocked: result.mocked });
  } catch (error) {
    return handleRouteError(error);
  }
}
