import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  completeCollabProjectFile,
  mapCollabFile,
} from "@/server/services/collaboration/collab-project-service";

const bodySchema = z.object({
  etag: z.string().optional().nullable(),
  checksum_sha256: z.string().optional().nullable(),
});

export async function POST(
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
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "요청 본문이 올바르지 않습니다.");
    }
    const row = await completeCollabProjectFile({
      projectId,
      fileId,
      buyerUserId: user.id,
      actorId: user.id,
      etag: parsed.data.etag,
      checksumSha256: parsed.data.checksum_sha256,
    });
    return ok(mapCollabFile(row));
  } catch (error) {
    return handleRouteError(error);
  }
}
