import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { presignCollabReplyFile } from "@/server/services/collaboration/collab-project-service";

const bodySchema = z.object({
  filename: z.string().min(1).max(512),
  size_bytes: z.number().int().positive(),
  mime_type: z.string().max(256).optional(),
});

export async function POST(
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
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "요청 본문이 올바르지 않습니다.");
    }
    const result = await presignCollabReplyFile({
      projectId,
      replyId,
      supplierId,
      actorId: user.id,
      filename: parsed.data.filename,
      sizeBytes: BigInt(parsed.data.size_bytes),
      mimeType: parsed.data.mime_type ?? "application/octet-stream",
    });
    return ok({
      fileId: result.fileId,
      storageKey: result.storageKey,
      uploadUrl: result.uploadUrl,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
