import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  createCollabReplyForSupplier,
  listCollabRepliesForSupplier,
  mapCollabReplyForBuyer,
} from "@/server/services/collaboration/collab-project-service";

const postBodySchema = z.object({
  body: z.string().min(1).max(200_000),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId!;
    const { projectId: idStr } = await params;
    const projectId = Number(idStr);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트입니다.");
    }
    const replies = await listCollabRepliesForSupplier(projectId, supplierId);
    return ok(replies.map(mapCollabReplyForBuyer));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    const supplierId = user.supplierId!;
    const { projectId: idStr } = await params;
    const projectId = Number(idStr);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트입니다.");
    }
    const json = await request.json();
    const parsed = postBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(400, "요청 본문이 올바르지 않습니다.");
    }
    const reply = await createCollabReplyForSupplier({
      projectId,
      supplierId,
      authorUserId: user.id,
      body: parsed.data.body,
    });
    return ok({
      id: reply.id,
      body: reply.body,
      createdAt: reply.created_at.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
