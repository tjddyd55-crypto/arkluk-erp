import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { acceptQuote } from "@/server/services/quote-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);

    const { id, quoteId } = await params;
    const projectId = Number(id);
    const numericQuoteId = Number(quoteId);
    if (Number.isNaN(projectId) || Number.isNaN(numericQuoteId)) {
      throw new HttpError(400, "유효하지 않은 ID입니다.");
    }

    const quote = await prisma.quote.findFirst({
      where: {
        id: numericQuoteId,
        project_id: projectId,
        buyer_id: user.id,
      },
      select: { id: true },
    });
    if (!quote) {
      throw new HttpError(404, "프로젝트 견적을 찾을 수 없습니다.");
    }

    const order = await acceptQuote(numericQuoteId, user.id);
    return ok({ action: "accept", order });
  } catch (error) {
    return handleRouteError(error);
  }
}
