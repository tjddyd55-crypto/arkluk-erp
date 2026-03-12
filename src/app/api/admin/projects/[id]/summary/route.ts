import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { getProjectSummaryForAdmin } from "@/server/services/project-service";

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

    const summary = await getProjectSummaryForAdmin(projectId);
    return ok(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}
