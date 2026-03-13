import { NextRequest } from "next/server";
import { ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    if (!user.countryId) {
      return ok([]);
    }
    const country = await prisma.country.findUnique({
      where: { id: user.countryId },
      select: { country_code: true },
    });
    if (!country) {
      return ok([]);
    }

    const suppliers = await prisma.supplier.findMany({
      where: {
        is_active: true,
        products: {
          some: {
            is_active: true,
            status: ProductStatus.APPROVED,
            country_code: country.country_code,
          },
        },
      },
      orderBy: [{ supplier_name: "asc" }],
    });
    return ok(suppliers);
  } catch (error) {
    return handleRouteError(error);
  }
}
