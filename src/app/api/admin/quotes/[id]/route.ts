import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendQuote } from "@/server/services/quote-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const quoteId = Number(id);
    if (Number.isNaN(quoteId)) {
      throw new HttpError(400, "유효하지 않은 견적 ID입니다.");
    }

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        buyer: true,
        country: true,
        supplier: true,
        quote_items: {
          include: { supplier: true, category: true, product: true },
        },
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
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const quoteId = Number(id);
    if (Number.isNaN(quoteId)) {
      throw new HttpError(400, "유효하지 않은 견적 ID입니다.");
    }

    await sendQuote(quoteId, user.id);
    return ok({ quoteId });
  } catch (error) {
    return handleRouteError(error);
  }
}
