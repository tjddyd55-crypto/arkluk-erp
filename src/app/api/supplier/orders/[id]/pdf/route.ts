import { NextRequest, NextResponse } from "next/server";
import { OrderSupplierStatus, PoPdfDownloadType } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { resolveSupplierOrderPdf } from "@/server/services/order-pdf-service";
import { logPoPdfDownload } from "@/server/services/po-pdf-download-log-service";

export async function GET(
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

    const orderSupplier = await prisma.orderSupplier.findFirst({
      where: {
        order_id: orderId,
        supplier_id: user.supplierId,
      },
    });

    if (!orderSupplier) {
      throw new HttpError(404, "주문을 찾을 수 없습니다.");
    }

    const lineCount = await prisma.orderItem.count({
      where: { order_id: orderId, supplier_id: user.supplierId },
    });
    if (lineCount === 0) {
      throw new HttpError(400, "발주서에 포함할 품목이 없습니다.");
    }

    if (orderSupplier.status === OrderSupplierStatus.SENT) {
      await prisma.orderSupplier.update({
        where: { id: orderSupplier.id },
        data: {
          status: OrderSupplierStatus.VIEWED,
          viewed_at: new Date(),
        },
      });
    }

    const { buffer, fileName } = await resolveSupplierOrderPdf({
      orderId,
      supplierId: user.supplierId,
    });

    await logPoPdfDownload({
      orderId,
      orderSupplierId: orderSupplier.id,
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
