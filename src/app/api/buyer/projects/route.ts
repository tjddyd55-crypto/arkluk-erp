import { NextRequest } from "next/server";
import { ProjectStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { projectStatusSchema } from "@/lib/schemas";
import { listBuyerProjects } from "@/server/services/project-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);

    const keyword = request.nextUrl.searchParams.get("keyword")?.trim();
    const statusRaw = request.nextUrl.searchParams.get("status");
    const dateFrom = request.nextUrl.searchParams.get("dateFrom");
    const dateTo = request.nextUrl.searchParams.get("dateTo");
    const parsedStatus = statusRaw
      ? projectStatusSchema.safeParse(statusRaw)
      : { success: true, data: undefined };
    if (!parsedStatus.success) {
      throw new HttpError(400, "유효하지 않은 프로젝트 상태 필터입니다.");
    }

    const projects = await listBuyerProjects(user.id, {
      keyword,
      status: parsedStatus.data as ProjectStatus | undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });

    return ok(projects);
  } catch (error) {
    return handleRouteError(error);
  }
}
