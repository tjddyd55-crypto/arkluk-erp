import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  getCollabReplyForSupplier,
  mapCollabReplyForBuyer,
} from "@/server/services/collaboration/collab-project-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; replyId: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId!;
    const { projectId: pStr, replyId: rStr } = await params;
    const projectId = Number(pStr);
    const replyId = Number(rStr);
    if (Number.isNaN(projectId) || Number.isNaN(replyId)) {
      throw new HttpError(400, "유효하지 않은 요청입니다.");
    }
    const reply = await getCollabReplyForSupplier(projectId, replyId, supplierId);
    return ok(mapCollabReplyForBuyer(reply));
  } catch (error) {
    return handleRouteError(error);
  }
}
