import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { softDeleteCollabReplyFile } from "@/server/services/collaboration/collab-project-service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; replyId: string; fileId: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId!;
    const { projectId: pStr, replyId: rStr, fileId: fStr } = await params;
    const projectId = Number(pStr);
    const replyId = Number(rStr);
    const fileId = Number(fStr);
    if (Number.isNaN(projectId) || Number.isNaN(replyId) || Number.isNaN(fileId)) {
      throw new HttpError(400, "유효하지 않은 요청입니다.");
    }
    await softDeleteCollabReplyFile({
      projectId,
      replyId,
      fileId,
      supplierId,
      actorId: user.id,
    });
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
