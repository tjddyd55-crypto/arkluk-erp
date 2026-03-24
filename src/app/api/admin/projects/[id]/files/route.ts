import path from "path";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { createProjectFileRecord, listProjectFilesForAdmin } from "@/server/services/project-service";
import { saveFile } from "@/server/services/storage-service";
import {
  ADMIN_PROJECT_FILE_MAX_BYTES,
  assertProjectUploadMimeMatchesExt,
  PROJECT_UPLOAD_BY_EXT,
  PROJECT_UPLOAD_EXT_SET,
} from "@/server/storage/storage-upload-policy";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const { id } = await params;
    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트 ID입니다.");
    }

    const files = await listProjectFilesForAdmin(projectId);
    return ok(files);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAuth(request, [...ADMIN_ROLES]);

    const { id } = await params;
    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트 ID입니다.");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "업로드 파일이 필요합니다.");
    }
    if (file.size <= 0 || file.size > ADMIN_PROJECT_FILE_MAX_BYTES) {
      throw new HttpError(
        400,
        `파일 크기는 1바이트 이상, ${Math.floor(ADMIN_PROJECT_FILE_MAX_BYTES / (1024 * 1024))}MB 이하여야 합니다.`,
      );
    }

    const ext = path.extname(file.name).replace(".", "").toLowerCase();
    if (!PROJECT_UPLOAD_EXT_SET.has(ext)) {
      throw new HttpError(400, "지원하지 않는 파일 형식입니다. (PDF/DWG/ZIP/PNG/JPG/JPEG)");
    }

    const spec = PROJECT_UPLOAD_BY_EXT[ext];
    if (!spec) {
      throw new HttpError(400, "지원하지 않는 파일 형식입니다.");
    }

    assertProjectUploadMimeMatchesExt(ext, file.type ?? "", spec);

    const extWithDot = path.extname(file.name).toLowerCase() || `.${ext}`;
    const safeName = `project_${projectId}_${Date.now()}_${randomUUID()}${extWithDot}`;
    const objectKey = `project-files/${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const storedKey = await saveFile(buffer, objectKey, spec.contentType);

    const created = await createProjectFileRecord({
      projectId,
      fileName: safeName,
      originalName: file.name,
      fileUrl: storedKey,
      fileSize: file.size,
      fileType: spec.fileType,
      uploadedBy: actor.id,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
