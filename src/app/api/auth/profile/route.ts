import { NextRequest } from "next/server";
import { Language } from "@prisma/client";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  email: z.string().trim().email().optional().nullable(),
  contactPhone: z.string().trim().max(50).optional().nullable(),
  language: z.nativeEnum(Language).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "프로필 변경 요청 형식이 올바르지 않습니다.");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: parsed.data.email ?? null,
        contact_phone: parsed.data.contactPhone ?? null,
        ...(parsed.data.language ? { language: parsed.data.language } : {}),
      },
      select: {
        id: true,
        email: true,
        contact_phone: true,
        language: true,
      },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
