import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);

    const quotes = await prisma.quote.findMany({
      where: { buyer_id: user.id },
      include: {
        supplier: true,
      },
      orderBy: [{ created_at: "desc" }],
    });
    return ok(quotes);
  } catch (error) {
    return handleRouteError(error);
  }
}
