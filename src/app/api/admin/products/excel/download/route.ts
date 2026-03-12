import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildProductExcel } from "@/server/services/excel-service";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const products = await prisma.product.findMany({
      include: { supplier: true, category: true },
      orderBy: [{ supplier_id: "asc" }, { category_id: "asc" }, { sort_order: "asc" }],
    });

    const rows = products.map((product) => ({
      공급사: product.supplier.supplier_name,
      카테고리: product.category.category_name,
      상품코드: product.product_code,
      상품명: product.product_name,
      규격: product.spec,
      단위: product.unit,
      가격: Number(product.price),
      메모: product.memo ?? "",
    }));

    const buffer = buildProductExcel(rows);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="products-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
