import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  getBuyerProjectDetail,
  getProjectSummaryForBuyer,
  listProjectFilesForBuyer,
  listProjectOrdersForBuyer,
} from "@/server/services/project-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);

    const { id } = await params;
    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트 ID입니다.");
    }

    const [project, files, orders, summary] = await Promise.all([
      getBuyerProjectDetail(projectId, user.id),
      listProjectFilesForBuyer(projectId, user.id),
      listProjectOrdersForBuyer(projectId, user.id),
      getProjectSummaryForBuyer(projectId, user.id),
    ]);

    return ok({
      project,
      files,
      orders,
      summary,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
