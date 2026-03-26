import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  assertBuyerOwnsCollabProject,
  collabReplyIncludeBuyer,
  mapCollabReplyForBuyer,
} from "@/server/services/collaboration/collab-project-service";

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
    await assertBuyerOwnsCollabProject(projectId, user.id);
    const replies = await prisma.collabProjectReply.findMany({
      where: { project_id: projectId, deleted_at: null },
      orderBy: { created_at: "desc" },
      include: collabReplyIncludeBuyer,
    });
    return ok(replies.map(mapCollabReplyForBuyer));
  } catch (error) {
    return handleRouteError(error);
  }
}
