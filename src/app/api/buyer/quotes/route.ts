import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    const where =
      user.role === Role.COUNTRY_ADMIN
        ? { country_id: user.countryId! }
        : { buyer_id: user.id };

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        buyer: true,
        supplier: true,
      },
      orderBy: [{ created_at: "desc" }],
    });
    return ok(quotes);
  } catch (error) {
    return handleRouteError(error);
  }
}
