import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { userUpsertSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/security";
import { createAuditLog } from "@/server/services/audit-log";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;

function validateRoleConstraints(payload: {
  role:
    | "SUPER_ADMIN"
    | "KOREA_SUPPLY_ADMIN"
    | "COUNTRY_ADMIN"
    | "ADMIN"
    | "BUYER"
    | "SUPPLIER";
  countryId?: number | null;
  supplierId?: number | null;
}) {
  if ((payload.role === "BUYER" || payload.role === "COUNTRY_ADMIN") && !payload.countryId) {
    throw new HttpError(400, "BUYER/COUNTRY_ADMIN은 countryId가 필수입니다.");
  }
  if (payload.role === "SUPPLIER" && !payload.supplierId) {
    throw new HttpError(400, "SUPPLIER는 supplierId가 필수입니다.");
  }
  if (
    ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN", "COUNTRY_ADMIN", "BUYER"].includes(
      payload.role,
    ) &&
    payload.supplierId
  ) {
    throw new HttpError(400, "관리자 계정에는 supplierId를 지정할 수 없습니다.");
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);

    const users = await prisma.user.findMany({
      include: {
        country: true,
        supplier: true,
      },
      orderBy: [{ created_at: "desc" }],
    });
    return ok(users);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request, [...ADMIN_ROLES]);
    const rawBody = await request.json();
    const body =
      rawBody && typeof rawBody === "object"
        ? {
            ...rawBody,
            loginId:
              (rawBody as { loginId?: unknown }).loginId ??
              (typeof (rawBody as { email?: unknown }).email === "string"
                ? (rawBody as { email: string }).email
                : undefined),
          }
        : rawBody;
    const parsed = userUpsertSchema.safeParse(body);
    if (!parsed.success || !parsed.data.password) {
      throw new HttpError(400, "사용자 요청 값이 올바르지 않습니다.");
    }
    validateRoleConstraints(parsed.data);

    if (actor.role === Role.KOREA_SUPPLY_ADMIN && parsed.data.role !== "SUPPLIER") {
      throw new HttpError(403, "KOREA_SUPPLY_ADMIN은 SUPPLIER 계정만 생성할 수 있습니다.");
    }
    if (parsed.data.role === "SUPPLIER") {
      if (!parsed.data.supplierId) {
        throw new HttpError(400, "SUPPLIER 계정 생성에는 supplierId가 필요합니다.");
      }
      if (!parsed.data.email) {
        throw new HttpError(400, "SUPPLIER 계정 생성에는 email이 필요합니다.");
      }
      const supplier = await prisma.supplier.findUnique({
        where: { id: parsed.data.supplierId },
        select: { id: true, is_active: true },
      });
      if (!supplier) {
        throw new HttpError(400, "연결할 공급사를 찾을 수 없습니다.");
      }
      if (!supplier.is_active) {
        throw new HttpError(400, "비활성 공급사에는 계정을 생성할 수 없습니다.");
      }
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const created = await prisma.user.create({
      data: {
        login_id: parsed.data.loginId,
        password_hash: passwordHash,
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        role: parsed.data.role,
        country_id: parsed.data.countryId ?? null,
        supplier_id: parsed.data.supplierId ?? null,
        is_active: parsed.data.isActive ?? true,
      },
    });

    await createAuditLog({
      actorId: actor.id,
      actionType: "CREATE_USER",
      targetType: "USER",
      targetId: created.id,
      afterData: {
        loginId: created.login_id,
        role: created.role,
      },
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
