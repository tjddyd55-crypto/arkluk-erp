import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const orderNo = request.nextUrl.searchParams.get("orderNo");
    const status = request.nextUrl.searchParams.get("status");
    const buyerName = request.nextUrl.searchParams.get("buyerName");
    const countryId = request.nextUrl.searchParams.get("countryId");

    const where: Prisma.OrderSupplierWhereInput = {
      supplier_id: user.supplierId,
      ...(status ? { status: status as Prisma.EnumOrderSupplierStatusFilter["equals"] } : {}),
      order: {
        ...(orderNo ? { order_no: { contains: orderNo, mode: "insensitive" } } : {}),
        ...(countryId ? { country_id: Number(countryId) } : {}),
        ...(buyerName ? { buyer: { name: { contains: buyerName, mode: "insensitive" } } } : {}),
      },
    };

    const records = await prisma.orderSupplier.findMany({
      where,
      include: {
        order: {
          include: {
            buyer: true,
            country: true,
          },
        },
      },
      orderBy: [{ created_at: "desc" }],
    });

    return ok(records);
  } catch (error) {
    return handleRouteError(error);
  }
}
