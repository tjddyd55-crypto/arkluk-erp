import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { countryUpsertSchema } from "@/lib/schemas";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const countryId = Number(id);
    if (Number.isNaN(countryId)) {
      throw new HttpError(400, "유효하지 않은 국가 ID입니다.");
    }

    const body = await request.json();
    const parsed = countryUpsertSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "국가 수정 값이 올바르지 않습니다.");
    }

    const before = await prisma.country.findUnique({ where: { id: countryId } });
    if (!before) {
      throw new HttpError(404, "국가를 찾을 수 없습니다.");
    }

    const updated = await prisma.country.update({
      where: { id: countryId },
      data: {
        country_code: parsed.data.countryCode,
        country_name: parsed.data.countryName,
        is_active: parsed.data.isActive,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "UPDATE_COUNTRY",
      targetType: "COUNTRY",
      targetId: countryId,
      beforeData: before,
      afterData: updated,
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
