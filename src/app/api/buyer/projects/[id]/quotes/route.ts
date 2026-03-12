import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { listProjectQuotesForBuyer } from "@/server/services/project-service";

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

    const quotes = await listProjectQuotesForBuyer(projectId, user.id);
    return ok(quotes);
  } catch (error) {
    return handleRouteError(error);
  }
}
