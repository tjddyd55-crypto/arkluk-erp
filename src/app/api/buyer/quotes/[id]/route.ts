import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { acceptQuote, markQuoteViewed, rejectQuote } from "@/server/services/quote-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { id } = await params;
    const quoteId = Number(id);
    if (Number.isNaN(quoteId)) {
      throw new HttpError(400, "유효하지 않은 견적 ID입니다.");
    }

    if (user.role !== Role.COUNTRY_ADMIN) {
      await markQuoteViewed(quoteId, user.id);
    }

    const quote = await prisma.quote.findFirst({
      where:
        user.role === Role.COUNTRY_ADMIN
          ? { id: quoteId, country_id: user.countryId! }
          : { id: quoteId, buyer_id: user.id },
      include: {
        buyer: true,
        quote_items: true,
        supplier: true,
      },
    });
    if (!quote) {
      throw new HttpError(404, "견적을 찾을 수 없습니다.");
    }

    return ok(quote);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const { id } = await params;
    const quoteId = Number(id);
    if (Number.isNaN(quoteId)) {
      throw new HttpError(400, "유효하지 않은 견적 ID입니다.");
    }

    if (user.role === Role.COUNTRY_ADMIN) {
      throw new HttpError(403, "COUNTRY_ADMIN은 견적 승인/거절 권한이 없습니다.");
    }

    const action = request.nextUrl.searchParams.get("action");
    if (action === "accept") {
      const order = await acceptQuote(quoteId, user.id);
      return ok({ action, order });
    }
    if (action === "reject") {
      await rejectQuote(quoteId, user.id);
      return ok({ action });
    }
    throw new HttpError(400, "지원하지 않는 action입니다.");
  } catch (error) {
    return handleRouteError(error);
  }
}
