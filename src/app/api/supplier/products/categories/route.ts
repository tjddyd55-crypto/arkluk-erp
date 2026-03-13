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

    const categories = await prisma.category.findMany({
      where: {
        supplier_id: user.supplierId,
        is_active: true,
      },
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    });
    return ok(categories);
  } catch (error) {
    return handleRouteError(error);
  }
}
