import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { readStoredFileBuffer } from "@/server/services/storage-service";

function toMimeType(type: string) {
  if (type === "PDF") return "application/pdf";
  return "application/xml";
}

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { fileId } = await params;
    const id = Number(fileId);
    if (Number.isNaN(id)) {
      throw new HttpError(400, "유효하지 않은 세금계산서 파일 ID입니다.");
    }

    const invoiceFile = await prisma.invoiceFile.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            order: {
              select: { buyer_id: true },
            },
          },
        },
      },
    });
    if (!invoiceFile || !invoiceFile.invoice.order || invoiceFile.invoice.order.buyer_id !== user.id) {
      throw new HttpError(404, "파일을 찾을 수 없습니다.");
    }

    const fileBuffer = await readStoredFileBuffer(invoiceFile.file_url);
    if (!fileBuffer) {
      throw new HttpError(404, "첨부파일을 찾을 수 없습니다.");
    }

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": toMimeType(invoiceFile.file_type),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(invoiceFile.file_name)}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
