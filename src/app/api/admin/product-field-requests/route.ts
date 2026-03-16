import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const status = request.nextUrl.searchParams.get("status")?.trim().toUpperCase();
    const supplierId = Number(request.nextUrl.searchParams.get("supplierId"));

    const rows = await prisma.supplierProductFieldRequest.findMany({
      where: {
        ...(status && ["PENDING", "APPROVED", "REJECTED"].includes(status)
          ? { status: status as "PENDING" | "APPROVED" | "REJECTED" }
          : {}),
        ...(Number.isNaN(supplierId) ? {} : { supplier_id: supplierId }),
      },
      include: {
        supplier: {
          select: { id: true, supplier_name: true, company_name: true },
        },
        reviewer: {
          select: { id: true, name: true, login_id: true },
        },
      },
      orderBy: [{ created_at: "desc" }],
    });
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
