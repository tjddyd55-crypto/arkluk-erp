import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

function toMimeType(type: "PDF" | "XML") {
  if (type === "PDF") {
    return "application/pdf";
  }
  return "application/xml";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const { fileId } = await params;
    const invoiceFileId = Number(fileId);
    if (Number.isNaN(invoiceFileId)) {
      throw new HttpError(400, "유효하지 않은 파일 ID입니다.");
    }

    const invoiceFile = await prisma.invoiceFile.findUnique({
      where: { id: invoiceFileId },
    });
    if (!invoiceFile) {
      throw new HttpError(404, "첨부파일을 찾을 수 없습니다.");
    }

    const absolutePath = path.join(process.cwd(), invoiceFile.file_url);
    const fileBuffer = await readFile(absolutePath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": toMimeType(invoiceFile.file_type),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          invoiceFile.file_name,
        )}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
