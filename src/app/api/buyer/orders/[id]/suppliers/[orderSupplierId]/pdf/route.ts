import { NextRequest, NextResponse } from "next/server";
import { PoPdfDownloadType, Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { resolveBuyerOrderSupplierPdf } from "@/server/services/order-pdf-service";
import { logPoPdfDownload } from "@/server/services/po-pdf-download-log-service";

export async function GET(
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

    const { buffer, fileName } = await resolveBuyerOrderSupplierPdf({
      orderId,
      orderSupplierId,
    });

    await logPoPdfDownload({
      orderId,
      orderSupplierId,
      userId: user.id,
      role: user.role,
      downloadType: PoPdfDownloadType.SUPPLIER_SECTION,
      request,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
