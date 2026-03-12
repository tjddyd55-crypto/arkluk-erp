import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { createQuoteSchema } from "@/lib/schemas";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createQuote } from "@/server/services/quote-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const quotes = await prisma.quote.findMany({
      where: {
        created_by: user.id,
      },
      include: {
        buyer: true,
        country: true,
      },
      orderBy: [{ created_at: "desc" }],
    });
    return ok(quotes);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const body = await request.json();
    const parsed = createQuoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "견적 생성 요청 형식이 올바르지 않습니다.");
    }

    const quote = await createQuote(
      {
        id: user.id,
        role: user.role,
        supplierId: user.supplierId,
      },
      { ...parsed.data, supplierId: user.supplierId },
    );
    return ok(quote, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
