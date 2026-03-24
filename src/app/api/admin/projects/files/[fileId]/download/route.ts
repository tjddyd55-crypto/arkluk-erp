import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { readStoredFileBuffer } from "@/server/services/storage-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

function toMimeType(type: string) {
  const upper = type.toUpperCase();
  if (upper === "PDF") return "application/pdf";
  if (upper === "DWG") return "application/acad";
  if (upper === "ZIP") return "application/zip";
  if (upper === "PNG") return "image/png";
  if (upper === "JPG" || upper === "JPEG") return "image/jpeg";
  return "application/octet-stream";
}

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const { fileId } = await params;
    const id = Number(fileId);
    if (Number.isNaN(id)) {
      throw new HttpError(400, "유효하지 않은 프로젝트 파일 ID입니다.");
    }

    const projectFile = await prisma.projectFile.findUnique({
      where: { id },
    });
    if (!projectFile) {
      throw new HttpError(404, "프로젝트 파일을 찾을 수 없습니다.");
    }

    const fileBuffer = await readStoredFileBuffer(projectFile.file_url);
    if (!fileBuffer) {
      throw new HttpError(404, "프로젝트 파일을 찾을 수 없습니다.");
    }

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": toMimeType(projectFile.file_type),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(projectFile.original_name)}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
