import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const projectId = Number(request.nextUrl.searchParams.get("projectId"));
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "projectId가 필요합니다.");
    }

    const files = await prisma.projectFile.findMany({
      where: { project_id: projectId },
      orderBy: [{ created_at: "desc" }],
    });
    return ok(files);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const body = (await request.json()) as {
      projectId?: number;
      fileName?: string;
      fileType?: string;
      fileUrl?: string;
    };

    if (!body.projectId || !body.fileName || !body.fileType || !body.fileUrl) {
      throw new HttpError(400, "projectId/fileName/fileType/fileUrl이 필요합니다.");
    }

    const file = await prisma.projectFile.create({
      data: {
        project_id: body.projectId,
        file_name: body.fileName,
        file_type: body.fileType,
        file_url: body.fileUrl,
        uploaded_by: user.id,
      },
    });
    return ok(file, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
