import { NextRequest } from "next/server";
import { Prisma, ProductStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["BUYER"]);
    if (!user.countryId) {
      return ok({ categories: [], products: [] });
    }
    const country = await prisma.country.findUnique({
      where: { id: user.countryId },
      select: { country_code: true },
    });
    if (!country) {
      return ok({ categories: [], products: [] });
    }
    const supplierId = toNumber(request.nextUrl.searchParams.get("supplierId"));
    const categoryId = toNumber(request.nextUrl.searchParams.get("categoryId"));
    const keyword = request.nextUrl.searchParams.get("keyword")?.trim();

    if (!supplierId) {
      return ok({ categories: [], products: [] });
    }

    const categories = await prisma.category.findMany({
      where: {
        supplier_id: supplierId,
        is_active: true,
      },
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    });

    const where: Prisma.ProductWhereInput = {
      supplier_id: supplierId,
      country_code: country.country_code,
      is_active: true,
      status: ProductStatus.APPROVED,
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(keyword
        ? {
            OR: [
              { product_code: { contains: keyword, mode: "insensitive" } },
              { product_name: { contains: keyword, mode: "insensitive" } },
              { spec: { contains: keyword, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    });

    return ok({ categories, products });
  } catch (error) {
    return handleRouteError(error);
  }
}
