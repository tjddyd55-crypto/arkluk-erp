import { NextRequest } from "next/server";
import { ProjectFileType } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { createProjectFileRecord, listProjectFilesForAdmin } from "@/server/services/project-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const projectId = Number(request.nextUrl.searchParams.get("projectId"));
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "projectId가 필요합니다.");
    }

    const files = await listProjectFilesForAdmin(projectId);
    return ok(files);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const body = (await request.json()) as {
      projectId?: number;
      fileName?: string;
      originalName?: string;
      fileSize?: number;
      fileType?: string;
      fileUrl?: string;
    };

    if (
      !body.projectId ||
      !body.fileName ||
      !body.fileType ||
      !body.fileUrl ||
      !body.originalName ||
      !body.fileSize
    ) {
      throw new HttpError(
        400,
        "projectId/fileName/originalName/fileSize/fileType/fileUrl이 필요합니다.",
      );
    }

    const type = body.fileType.toUpperCase();
    if (
      !["PDF", "DWG", "ZIP", "PNG", "JPG", "JPEG"].includes(type)
    ) {
      throw new HttpError(400, "지원하지 않는 파일 타입입니다.");
    }

    const file = await createProjectFileRecord({
      projectId: body.projectId,
      fileName: body.fileName,
      originalName: body.originalName,
      fileSize: body.fileSize,
      fileType: type as ProjectFileType,
      fileUrl: body.fileUrl,
      uploadedBy: user.id,
    });
    return ok(file, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
