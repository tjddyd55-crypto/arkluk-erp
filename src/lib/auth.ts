import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/security";

export type AuthUser = {
  id: number;
  loginId: string;
  role: Role;
  name: string;
  countryId: number | null;
  supplierId: number | null;
  isActive: boolean;
};

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

  if (roles && !roles.includes(user.role)) {
    throw new HttpError(403, "권한이 없습니다.");
  }

  return user;
}
