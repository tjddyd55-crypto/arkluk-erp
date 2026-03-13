import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/schemas";
import { signSession, verifyPassword } from "@/lib/security";
import { createAuditLog } from "@/server/services/audit-log";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "로그인 요청 형식이 올바르지 않습니다.");
    }

    const user = await prisma.user.findUnique({
      where: { login_id: parsed.data.loginId },
    });
    if (!user || !user.is_active) {
      throw new HttpError(401, "로그인 정보가 올바르지 않습니다.");
    }

    const valid = await verifyPassword(parsed.data.password, user.password_hash);
    if (!valid) {
      throw new HttpError(401, "로그인 정보가 올바르지 않습니다.");
    }

    if ((user.role === "BUYER" || user.role === "COUNTRY_ADMIN") && !user.country_id) {
      throw new HttpError(400, "BUYER/COUNTRY_ADMIN 계정에는 country_id가 필요합니다.");
    }
    if (user.role === "SUPPLIER" && !user.supplier_id) {
      throw new HttpError(400, "SUPPLIER 계정에는 supplier_id가 필요합니다.");
    }

    const token = await signSession({
      userId: user.id,
      role: user.role,
      countryId: user.country_id,
      supplierId: user.supplier_id,
    });

    await createAuditLog({
      actorId: user.id,
      actionType: "LOGIN",
      targetType: "USER",
      targetId: user.id,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        loginId: user.login_id,
        name: user.name,
        role: user.role,
      },
    });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 10,
    });
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  const response = ok({ message: "로그아웃 완료" });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    expires: new Date(0),
  });
  return response;
}
