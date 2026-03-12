import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const products = await prisma.product.findMany({
      where: { supplier_id: user.supplierId },
      include: {
        category: true,
      },
      orderBy: [{ category_id: "asc" }, { sort_order: "asc" }],
    });
    return ok(products);
  } catch (error) {
    return handleRouteError(error);
  }
}
