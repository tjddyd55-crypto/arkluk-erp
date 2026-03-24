import { NextRequest, NextResponse } from "next/server";
import { PoPdfDownloadType, Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  resolveBuyerOrderCombinedPdf,
  tryOpenStoredCombinedPdfStream,
} from "@/server/services/order-pdf-service";
import { logPoPdfDownload } from "@/server/services/po-pdf-download-log-service";
import { storedFileStreamToWebBody } from "@/server/services/storage-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, "유효하지 않은 주문 ID입니다.");
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

    const streamed = await tryOpenStoredCombinedPdfStream(orderId);

    await logPoPdfDownload({
      orderId,
      orderSupplierId: null,
      userId: user.id,
      role: user.role,
      downloadType: PoPdfDownloadType.COMBINED,
      request,
    });

    if (streamed) {
      return new Response(storedFileStreamToWebBody(streamed.stream), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${streamed.fileName}"`,
        },
      });
    }

    const { buffer, fileName } = await resolveBuyerOrderCombinedPdf(orderId);

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
