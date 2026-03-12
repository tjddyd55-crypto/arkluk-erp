import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const projects = await prisma.project.findMany({
      include: {
        buyer: true,
        country: true,
      },
      orderBy: [{ created_at: "desc" }],
    });
    return ok(projects);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const body = (await request.json()) as {
      projectName?: string;
      buyerId?: number;
      countryId?: number;
      memo?: string | null;
    };
    if (!body.projectName || !body.buyerId || !body.countryId) {
      throw new HttpError(400, "projectName, buyerId, countryId가 필요합니다.");
    }

    const project = await prisma.project.create({
      data: {
        project_name: body.projectName,
        buyer_id: body.buyerId,
        country_id: body.countryId,
        memo: body.memo ?? null,
      },
    });
    return ok(project, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
