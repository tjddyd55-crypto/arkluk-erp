import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { ProjectFileType } from "@prisma/client";
import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { createProjectFileRecord, listProjectFilesForAdmin } from "@/server/services/project-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const extensionToType: Record<string, ProjectFileType> = {
  pdf: ProjectFileType.PDF,
  dwg: ProjectFileType.DWG,
  zip: ProjectFileType.ZIP,
  png: ProjectFileType.PNG,
  jpg: ProjectFileType.JPG,
  jpeg: ProjectFileType.JPEG,
};

function resolveFileTypeByName(fileName: string) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  return ext ? extensionToType[ext] : undefined;
}

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
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      throw new HttpError(400, "파일 크기는 1바이트 이상, 20MB 이하여야 합니다.");
    }

    const fileType = resolveFileTypeByName(file.name);
    if (!fileType) {
      throw new HttpError(400, "지원하지 않는 파일 형식입니다. (PDF/DWG/ZIP/PNG/JPG/JPEG)");
    }

    const targetDir = path.join(process.cwd(), "storage", "project-files");
    await mkdir(targetDir, { recursive: true });

    const ext = path.extname(file.name).toLowerCase();
    const safeName = `project_${projectId}_${Date.now()}_${randomUUID()}${ext}`;
    const absolutePath = path.join(targetDir, safeName);
    const relativePath = path.join("storage", "project-files", safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    const created = await createProjectFileRecord({
      projectId,
      fileName: safeName,
      originalName: file.name,
      fileUrl: relativePath,
      fileSize: file.size,
      fileType,
      uploadedBy: actor.id,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
