import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { categoryUpsertSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const categoryId = Number(id);
    if (Number.isNaN(categoryId)) {
      throw new HttpError(400, "유효하지 않은 카테고리 ID입니다.");
    }

    const body = await request.json();
    const parsed = categoryUpsertSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "카테고리 수정 값이 올바르지 않습니다.");
    }

    const before = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!before) {
      throw new HttpError(404, "카테고리를 찾을 수 없습니다.");
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        supplier_id: parsed.data.supplierId,
        category_name: parsed.data.categoryName,
        sort_order: parsed.data.sortOrder,
        is_active: parsed.data.isActive,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "UPDATE_CATEGORY",
      targetType: "CATEGORY",
      targetId: categoryId,
      beforeData: before,
      afterData: updated,
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
