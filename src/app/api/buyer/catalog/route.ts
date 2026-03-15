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
              { name_original: { contains: keyword, mode: "insensitive" } },
              { spec: { contains: keyword, mode: "insensitive" } },
              {
                translations: {
                  some: {
                    language: user.language,
                    name: { contains: keyword, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const products = await prisma.product.findMany({
      where,
      include: {
        translations: {
          where: { language: user.language },
          select: { name: true, description: true },
          take: 1,
        },
      },
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    });

    const localizedProducts = products.map((product) => {
      const translation = product.translations[0];
      const localizedName = translation?.name ?? product.name_original ?? product.product_name;
      const localizedDescription =
        translation?.description ?? product.description_original ?? product.description ?? product.memo ?? null;

      return {
        ...product,
        product_name: localizedName,
        name: localizedName,
        description: localizedDescription,
        memo: localizedDescription,
        translations: undefined,
      };
    });

    return ok({ categories, products: localizedProducts });
  } catch (error) {
    return handleRouteError(error);
  }
}
