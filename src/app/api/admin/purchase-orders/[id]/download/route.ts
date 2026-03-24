import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { readStoredFileBuffer } from "@/server/services/storage-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const purchaseOrderId = Number(id);
    if (Number.isNaN(purchaseOrderId)) {
      throw new HttpError(400, "유효하지 않은 발주서 ID입니다.");
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    });
    if (!purchaseOrder) {
      throw new HttpError(404, "발주서를 찾을 수 없습니다.");
    }

    const fileBuffer = await readStoredFileBuffer(purchaseOrder.file_url);
    if (!fileBuffer) {
      throw new HttpError(404, "발주서 파일을 찾을 수 없습니다.");
    }

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          purchaseOrder.file_name,
        )}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
