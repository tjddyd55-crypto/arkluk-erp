import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { AUTH_COOKIE_NAME } from "@/lib/constants";

type SessionPayload = {
  role?: string;
};

function getDefaultPathByRole(role?: string) {
  if (role === "SUPPLIER") {
    return "/supplier";
  }
  if (role === "COUNTRY_ADMIN" || role === "BUYER") {
    return "/buyer";
  }
  if (role === "KOREA_SUPPLY_ADMIN" || role === "ADMIN" || role === "SUPER_ADMIN") {
    return "/admin";
  }
  return "/";
}

function canAccessPath(role: string | undefined, pathname: string) {
  if (!role) {
    return false;
  }
  if (role === "SUPER_ADMIN") {
    return true;
  }

  const isAdminPath = pathname.startsWith("/admin");
  const isBuyerPath = pathname.startsWith("/buyer");
  const isSupplierPath = pathname.startsWith("/supplier");

  if (role === "KOREA_SUPPLY_ADMIN" || role === "ADMIN") {
    return isAdminPath;
  }
  if (role === "COUNTRY_ADMIN" || role === "BUYER") {
    return isBuyerPath;
  }
  if (role === "SUPPLIER") {
    return isSupplierPath;
  }
  return false;
}

async function readRoleFromToken(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return (payload as SessionPayload).role ?? null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/buyer") ||
    pathname.startsWith("/supplier");

  if (!isProtected && pathname !== "/login") {
    return NextResponse.next();
  }

  if (!token) {
    if (isProtected) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  const role = await readRoleFromToken(token);
  if (!role) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(AUTH_COOKIE_NAME, "", {
      httpOnly: true,
      path: "/",
      expires: new Date(0),
    });
    return response;
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(getDefaultPathByRole(role), request.url));
  }

  if (isProtected && !canAccessPath(role, pathname)) {
    return NextResponse.redirect(new URL(getDefaultPathByRole(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/buyer/:path*", "/supplier/:path*", "/login"],
};
