import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { regenerateSupplierSectionPdf } from "@/server/services/order-pdf-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderSupplierId: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { id, orderSupplierId: sid } = await params;
    const orderId = Number(id);
    const orderSupplierId = Number(sid);
    if (Number.isNaN(orderId) || Number.isNaN(orderSupplierId)) {
      throw new HttpError(400, "유효하지 않은 ID입니다.");
    }

    const allowed = await prisma.order.findFirst({
      where:
        user.role === Role.COUNTRY_ADMIN
          ? { id: orderId, country_id: user.countryId! }
          : { id: orderId, buyer_id: user.id },
      select: { id: true },
    });
    if (!allowed) {
      throw new HttpError(404, "주문을 찾을 수 없습니다.");
    }

    const os = await prisma.orderSupplier.findFirst({
      where: { id: orderSupplierId, order_id: orderId },
      select: { id: true },
    });
    if (!os) {
      throw new HttpError(404, "공급사 주문 구간을 찾을 수 없습니다.");
    }

    await regenerateSupplierSectionPdf(orderSupplierId);

    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
