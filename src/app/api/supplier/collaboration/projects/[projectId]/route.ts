import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  getCollabProjectDetailForSupplier,
  mapCollabFile,
} from "@/server/services/collaboration/collab-project-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    await requireAuth(request, ["SUPPLIER"]);
    const { projectId: idStr } = await params;
    const projectId = Number(idStr);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트입니다.");
    }
    const project = await getCollabProjectDetailForSupplier(projectId);
    if (!project) {
      throw new HttpError(404, "프로젝트를 찾을 수 없습니다.");
    }
    return ok({
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      createdAt: project.created_at.toISOString(),
      files: project.files
        .filter((f) => f.upload_status === "COMPLETED")
        .map(mapCollabFile),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
