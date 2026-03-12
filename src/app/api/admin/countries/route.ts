import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth";
import { countryUpsertSchema } from "@/lib/schemas";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const countries = await prisma.country.findMany({
      orderBy: [{ country_name: "asc" }],
    });
    return ok(countries);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, [...ADMIN_ROLES]);
    const body = await request.json();
    const parsed = countryUpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "국가 요청 값이 올바르지 않습니다.");
    }

    const created = await prisma.country.create({
      data: {
        country_code: parsed.data.countryCode,
        country_name: parsed.data.countryName,
        is_active: parsed.data.isActive ?? true,
      },
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "CREATE_COUNTRY",
      targetType: "COUNTRY",
      targetId: created.id,
      afterData: parsed.data,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
