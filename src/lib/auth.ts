import { NextRequest } from "next/server";
import { Language, Role } from "@prisma/client";

import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/security";

export type AuthUser = {
  id: number;
  loginId: string;
  role: Role;
  language: Language;
  name: string;
  countryId: number | null;
  supplierId: number | null;
  isActive: boolean;
};

const ROLE_ALIASES: Partial<Record<Role, Role[]>> = {
  ADMIN: [Role.KOREA_SUPPLY_ADMIN],
  KOREA_SUPPLY_ADMIN: [Role.ADMIN],
  BUYER: [Role.COUNTRY_ADMIN],
};

function expandAllowedRoles(roles?: Role[]) {
  if (!roles || roles.length === 0) {
    return roles;
  }
  const roleSet = new Set<Role>(roles);
  for (const role of roles) {
    for (const alias of ROLE_ALIASES[role] ?? []) {
      roleSet.add(alias);
    }
  }
  return [...roleSet];
}

function readToken(req: NextRequest) {
  return req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const token = readToken(req);
  if (!token) {
    return null;
  }

  try {
    const payload = await verifySession(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        login_id: true,
        role: true,
        language: true,
        name: true,
        country_id: true,
        supplier_id: true,
        is_active: true,
      },
    });

    if (!user || !user.is_active) {
      return null;
    }

    return {
      id: user.id,
      loginId: user.login_id,
      role: user.role,
      language: user.language,
      name: user.name,
      countryId: user.country_id,
      supplierId: user.supplier_id,
      isActive: user.is_active,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(req: NextRequest, roles?: Role[]) {
  const user = await getAuthUser(req);
  if (!user) {
    throw new HttpError(401, "인증이 필요합니다.");
  }

  if (user.role === Role.SUPPLIER && !user.supplierId) {
    throw new HttpError(403, "SUPPLIER 계정에는 supplier_id가 필요합니다.");
  }
  if (user.role === Role.COUNTRY_ADMIN && !user.countryId) {
    throw new HttpError(403, "COUNTRY_ADMIN 계정에는 country_id가 필요합니다.");
  }
  if (user.role === Role.BUYER && !user.countryId) {
    throw new HttpError(403, "BUYER 계정에는 country_id가 필요합니다.");
  }

  if (user.role === Role.SUPER_ADMIN) {
    return user;
  }

  const allowedRoles = expandAllowedRoles(roles);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new HttpError(403, "권한이 없습니다.");
  }

  return user;
}
