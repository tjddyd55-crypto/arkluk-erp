import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { userUpsertSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/security";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

function validateRoleConstraints(payload: {
  role?: "SUPER_ADMIN" | "ADMIN" | "BUYER" | "SUPPLIER";
  countryId?: number | null;
  supplierId?: number | null;
}) {
  if (payload.role === "BUYER" && !payload.countryId) {
    throw new HttpError(400, "BUYER는 countryId가 필수입니다.");
  }
  if (payload.role === "SUPPLIER" && !payload.supplierId) {
    throw new HttpError(400, "SUPPLIER는 supplierId가 필수입니다.");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const userId = Number(id);
    if (Number.isNaN(userId)) {
      throw new HttpError(400, "유효하지 않은 사용자 ID입니다.");
    }

    const body = await request.json();
    const parsed = userUpsertSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "사용자 수정 값이 올바르지 않습니다.");
    }
    validateRoleConstraints(parsed.data);

    const before = await prisma.user.findUnique({ where: { id: userId } });
    if (!before) {
      throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        login_id: parsed.data.loginId,
        password_hash: parsed.data.password
          ? await hashPassword(parsed.data.password)
          : undefined,
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        country_id: parsed.data.countryId,
        supplier_id: parsed.data.supplierId,
        is_active: parsed.data.isActive,
      },
    });

    await createAuditLog({
      actorId: actor.id,
      actionType: "UPDATE_USER",
      targetType: "USER",
      targetId: userId,
      beforeData: { role: before.role, isActive: before.is_active },
      afterData: { role: updated.role, isActive: updated.is_active },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
