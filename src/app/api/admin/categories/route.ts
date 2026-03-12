import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { categoryUpsertSchema } from "@/lib/schemas";
import { toNumber } from "@/lib/utils";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const supplierId = toNumber(request.nextUrl.searchParams.get("supplierId"));
    const isActive = request.nextUrl.searchParams.get("isActive");

    const categories = await prisma.category.findMany({
      where: {
        ...(supplierId ? { supplier_id: supplierId } : {}),
        ...(isActive ? { is_active: isActive === "true" } : {}),
      },
      include: {
        supplier: true,
      },
      orderBy: [{ supplier_id: "asc" }, { sort_order: "asc" }],
    });
    return ok(categories);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const body = await request.json();
    const parsed = categoryUpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "카테고리 요청 값이 올바르지 않습니다.");
    }

    const created = await prisma.category.create({
      data: {
        supplier_id: parsed.data.supplierId,
        category_name: parsed.data.categoryName,
        sort_order: parsed.data.sortOrder,
        is_active: parsed.data.isActive ?? true,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "CREATE_CATEGORY",
      targetType: "CATEGORY",
      targetId: created.id,
      afterData: parsed.data,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
