import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { createQuoteSchema } from "@/lib/schemas";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createQuote } from "@/server/services/quote-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const status = request.nextUrl.searchParams.get("status");
    const countryId = request.nextUrl.searchParams.get("countryId");
    const buyerId = request.nextUrl.searchParams.get("buyerId");

    const where: Prisma.QuoteWhereInput = {
      ...(status ? { status: status as Prisma.EnumQuoteStatusFilter["equals"] } : {}),
      ...(countryId ? { country_id: Number(countryId) } : {}),
      ...(buyerId ? { buyer_id: Number(buyerId) } : {}),
    };

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        buyer: true,
        country: true,
        supplier: true,
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
    const user = await requireAuth(request, [...ADMIN_ROLES]);
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
      parsed.data,
    );
    return ok(quote, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
