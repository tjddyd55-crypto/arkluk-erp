import { NextRequest } from "next/server";
import { ProjectStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { projectStatusSchema, projectUpsertSchema } from "@/lib/schemas";
import { toNumber } from "@/lib/utils";
import { createProject, listAdminProjects } from "@/server/services/project-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const countryId = toNumber(request.nextUrl.searchParams.get("countryId"));
    const buyerId = toNumber(request.nextUrl.searchParams.get("buyerId"));
    const keyword = request.nextUrl.searchParams.get("keyword")?.trim();
    const dateFrom = request.nextUrl.searchParams.get("dateFrom");
    const dateTo = request.nextUrl.searchParams.get("dateTo");
    const statusRaw = request.nextUrl.searchParams.get("status");
    const parsedStatus = statusRaw
      ? projectStatusSchema.safeParse(statusRaw)
      : { success: true, data: undefined };
    if (!parsedStatus.success) {
      throw new HttpError(400, "유효하지 않은 프로젝트 상태 필터입니다.");
    }

    const projects = await listAdminProjects({
      countryId: countryId ?? undefined,
      buyerId: buyerId ?? undefined,
      status: parsedStatus.data as ProjectStatus | undefined,
      keyword,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });

    return ok(projects);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, [...ADMIN_ROLES]);
    const body = await request.json();
    const parsed = projectUpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "프로젝트 생성 요청 형식이 올바르지 않습니다.");
    }

    const project = await createProject(actor.id, {
      projectName: parsed.data.projectName,
      buyerId: parsed.data.buyerId,
      countryId: parsed.data.countryId,
      memo: parsed.data.memo ?? null,
      location: parsed.data.location ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      status: parsed.data.status,
    });

    return ok(project, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
