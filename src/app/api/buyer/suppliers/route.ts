import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["BUYER"]);

    const suppliers = await prisma.supplier.findMany({
      where: { is_active: true },
      orderBy: [{ supplier_name: "asc" }],
    });
    return ok(suppliers);
  } catch (error) {
    return handleRouteError(error);
  }
}
