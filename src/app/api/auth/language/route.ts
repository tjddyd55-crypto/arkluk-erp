import { NextRequest } from "next/server";
import { Language } from "@prisma/client";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateLanguageSchema = z.object({
  language: z.nativeEnum(Language),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const parsed = updateLanguageSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "언어 변경 요청 형식이 올바르지 않습니다.");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { language: parsed.data.language },
      select: {
        id: true,
        language: true,
      },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
