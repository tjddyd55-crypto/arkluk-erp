import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { Role } from "@prisma/client";

import { env } from "@/lib/env";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export type SessionPayload = {
  userId: number;
  role: Role;
  countryId: number | null;
  supplierId: number | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10h")
    .sign(secret);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret);

  return payload as unknown as SessionPayload;
}
