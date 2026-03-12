import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { createProjectQuoteSchema } from "@/lib/schemas";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { createQuote } from "@/server/services/quote-service";
import { getAdminProjectDetail, listProjectQuotesForAdmin } from "@/server/services/project-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const { id } = await params;
    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트 ID입니다.");
    }

    const quotes = await listProjectQuotesForAdmin(projectId);
    return ok(quotes);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAuth(request, [...ADMIN_ROLES]);

    const { id } = await params;
    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
      throw new HttpError(400, "유효하지 않은 프로젝트 ID입니다.");
    }

    const body = await request.json();
    const parsed = createProjectQuoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "프로젝트 견적 생성 요청 형식이 올바르지 않습니다.");
    }

    const project = await getAdminProjectDetail(projectId);
    const quote = await createQuote(
      {
        id: actor.id,
        role: actor.role,
        supplierId: actor.supplierId,
      },
      {
        buyerId: project.buyer_id,
        countryId: project.country_id,
        projectId,
        memo: parsed.data.memo ?? null,
        items: parsed.data.items,
      },
    );

    return ok(quote, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
