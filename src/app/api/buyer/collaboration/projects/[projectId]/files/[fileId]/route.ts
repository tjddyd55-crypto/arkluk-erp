import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { softDeleteCollabProjectFile } from "@/server/services/collaboration/collab-project-service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { projectId: pStr, fileId: fStr } = await params;
    const projectId = Number(pStr);
    const fileId = Number(fStr);
    if (Number.isNaN(projectId) || Number.isNaN(fileId)) {
      throw new HttpError(400, "유효하지 않은 요청입니다.");
    }
    await softDeleteCollabProjectFile({
      projectId,
      fileId,
      buyerUserId: user.id,
      actorId: user.id,
    });
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
