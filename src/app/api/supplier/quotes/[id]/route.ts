import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendQuote } from "@/server/services/quote-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id } = await params;
    const quoteId = Number(id);
    if (Number.isNaN(quoteId)) {
      throw new HttpError(400, "유효하지 않은 견적 ID입니다.");
    }

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, created_by: user.id },
      include: {
        buyer: true,
        quote_items: true,
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
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const { id } = await params;
    const quoteId = Number(id);
    if (Number.isNaN(quoteId)) {
      throw new HttpError(400, "유효하지 않은 견적 ID입니다.");
    }

    const exists = await prisma.quote.findFirst({
      where: { id: quoteId, created_by: user.id },
      select: { id: true },
    });
    if (!exists) {
      throw new HttpError(404, "견적을 찾을 수 없습니다.");
    }

    await sendQuote(quoteId, user.id);
    return ok({ quoteId });
  } catch (error) {
    return handleRouteError(error);
  }
}
