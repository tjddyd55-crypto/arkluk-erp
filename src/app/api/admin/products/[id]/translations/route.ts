import { NextRequest } from "next/server";
import { Language } from "@prisma/client";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n-config";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["SUPER_ADMIN", "KOREA_SUPPLY_ADMIN", "ADMIN"] as const;
const languageSchema = z.enum(SUPPORTED_LANGUAGES);

const updateTranslationSchema = z.object({
  language: languageSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        product_code: true,
        product_name: true,
        source_language: true,
        name_original: true,
        description_original: true,
        translations: {
          select: {
            language: true,
            name: true,
            description: true,
            is_auto: true,
          },
        },
      },
    });
    if (!product) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }

    const translationMap = new Map(product.translations.map((item) => [item.language, item]));
    const rows = SUPPORTED_LANGUAGES.map((language) => {
      if (language === product.source_language) {
        return {
          language,
          isSource: true,
          isAuto: false,
          name: product.name_original,
          description: product.description_original,
        };
      }

      const translation = translationMap.get(language as Language);
      return {
        language,
        isSource: false,
        isAuto: translation?.is_auto ?? false,
        name: translation?.name ?? "",
        description: translation?.description ?? "",
      };
    });

    return ok({
      product: {
        id: product.id,
        productCode: product.product_code,
        productName: product.product_name,
        sourceLanguage: product.source_language,
      },
      translations: rows,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request, [...ADMIN_ROLES]);
    const { id } = await params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, "유효하지 않은 상품 ID입니다.");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = updateTranslationSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "번역 수정 값이 올바르지 않습니다.");
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        source_language: true,
      },
    });
    if (!product) {
      throw new HttpError(404, "상품을 찾을 수 없습니다.");
    }

    if (parsed.data.language === product.source_language) {
      const updated = await prisma.product.update({
        where: { id: productId },
        data: {
          name_original: parsed.data.name,
          description_original: parsed.data.description ?? null,
          product_name: parsed.data.name,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          memo: parsed.data.description ?? null,
        },
        select: {
          id: true,
          source_language: true,
          name_original: true,
          description_original: true,
        },
      });
      return ok(updated);
    }

    const updated = await prisma.productTranslation.upsert({
      where: {
        product_id_language: {
          product_id: productId,
          language: parsed.data.language as Language,
        },
      },
      update: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        is_auto: false,
      },
      create: {
        product_id: productId,
        language: parsed.data.language as Language,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        is_auto: false,
      },
      select: {
        id: true,
        language: true,
        name: true,
        description: true,
        is_auto: true,
      },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
