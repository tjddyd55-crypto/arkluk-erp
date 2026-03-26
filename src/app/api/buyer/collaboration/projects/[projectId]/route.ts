import { NextRequest } from "next/server";
import { CollabProjectStatus } from "@prisma/client";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  getCollabProjectDetailForBuyer,
  mapCollabFile,
  mapCollabReplyForBuyer,
  patchCollabProject,
  softDeleteCollabProject,
} from "@/server/services/collaboration/collab-project-service";

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(200_000).optional(),
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { projectId: idStr } = await params;
    const projectId = Number(idStr);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트입니다.");
    }
    const project = await getCollabProjectDetailForBuyer(projectId, user.id);
    return ok({
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      createdAt: project.created_at.toISOString(),
      updatedAt: project.updated_at.toISOString(),
      files: project.files
        .filter((f) => f.upload_status === "COMPLETED")
        .map(mapCollabFile),
      replies: project.replies.map(mapCollabReplyForBuyer),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { projectId: idStr } = await params;
    const projectId = Number(idStr);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트입니다.");
    }
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "요청 본문이 올바르지 않습니다.");
    }
    const row = await patchCollabProject({
      projectId,
      buyerUserId: user.id,
      actorId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status as CollabProjectStatus | undefined,
    });
    return ok({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      updatedAt: row.updated_at.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { projectId: idStr } = await params;
    const projectId = Number(idStr);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트입니다.");
    }
    await softDeleteCollabProject(projectId, user.id, user.id);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
