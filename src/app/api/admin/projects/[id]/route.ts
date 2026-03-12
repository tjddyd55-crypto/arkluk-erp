import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { projectPatchSchema } from "@/lib/schemas";
import { getAdminProjectDetail, updateProject } from "@/server/services/project-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

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

    const project = await getAdminProjectDetail(projectId);
    return ok(project);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
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

    const body = await request.json();
    const parsed = projectPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "프로젝트 수정 요청 형식이 올바르지 않습니다.");
    }

    const project = await updateProject(projectId, actor.id, {
      projectName: parsed.data.projectName,
      buyerId: parsed.data.buyerId,
      countryId: parsed.data.countryId,
      memo: parsed.data.memo,
      location: parsed.data.location,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      status: parsed.data.status,
    });

    return ok(project);
  } catch (error) {
    return handleRouteError(error);
  }
}
