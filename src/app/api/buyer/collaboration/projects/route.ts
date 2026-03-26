import { NextRequest } from "next/server";
import { CollabProjectStatus } from "@prisma/client";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import {
  createCollabProject,
  listCollabProjectsForBuyer,
  mapCollabFile,
} from "@/server/services/collaboration/collab-project-service";

const createBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(200_000),
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const rows = await listCollabProjectsForBuyer(user.id);
    return ok(
      rows.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        createdAt: p.created_at.toISOString(),
        fileCount: p.files.length,
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const body = await request.json();
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "요청 본문이 올바르지 않습니다.");
    }
    const status = (parsed.data.status ?? "OPEN") as CollabProjectStatus;
    if (status !== CollabProjectStatus.DRAFT && status !== CollabProjectStatus.OPEN) {
      throw new HttpError(400, "초기 생성은 DRAFT 또는 OPEN만 허용됩니다.");
    }
    const row = await createCollabProject({
      buyerUserId: user.id,
      createdByUserId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      status,
    });
    return ok({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      files: [] as ReturnType<typeof mapCollabFile>[],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
