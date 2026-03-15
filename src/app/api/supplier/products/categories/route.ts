import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

const createSupplierCategorySchema = z.object({
  categoryName: z.string().trim().min(1).max(100),
  sortOrder: z.coerce.number().int().optional().default(0),
});

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

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPPLIER"]);
    if (!user.supplierId) {
      throw new HttpError(400, "공급사 계정 정보가 올바르지 않습니다.");
    }

    const parsed = createSupplierCategorySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, "카테고리 요청 값이 올바르지 않습니다.");
    }

    const existing = await prisma.category.findFirst({
      where: {
        supplier_id: user.supplierId,
        category_name: parsed.data.categoryName,
      },
      select: { id: true },
    });
    if (existing) {
      throw new HttpError(409, "이미 등록된 카테고리명입니다.");
    }

    const created = await prisma.category.create({
      data: {
        supplier_id: user.supplierId,
        category_name: parsed.data.categoryName,
        sort_order: parsed.data.sortOrder,
        is_active: true,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "SUPPLIER_CREATE_CATEGORY",
      targetType: "CATEGORY",
      targetId: created.id,
      afterData: created,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
