import { Language, Prisma, PrismaClient } from "@prisma/client";
import translate from "google-translate-api-x";

import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

type GenerateProductTranslationInput = {
  productId: number;
  nameOriginal: string;
  descriptionOriginal?: string | null;
  sourceLanguage: Language;
  tx?: Prisma.TransactionClient;
};

const AUTO_TRANSLATION_TARGETS: Language[] = [Language.en, Language.mn, Language.ar];

const TRANSLATION_LANGUAGE_MAP: Record<Language, string> = {
  ko: "ko",
  en: "en",
  mn: "mn",
  ar: "ar",
};

function getClient(tx?: Prisma.TransactionClient): DbClient {
  return tx ?? prisma;
}

async function translateText(text: string, source: Language, target: Language): Promise<string> {
  const result = await translate(text, {
    from: TRANSLATION_LANGUAGE_MAP[source],
    to: TRANSLATION_LANGUAGE_MAP[target],
  });
  return result.text.trim();
}

export async function generateProductTranslations(input: GenerateProductTranslationInput) {
  const client = getClient(input.tx);

  for (const targetLanguage of AUTO_TRANSLATION_TARGETS) {
    try {
      const shouldTranslate = targetLanguage !== input.sourceLanguage;
      const translatedName = shouldTranslate
        ? await translateText(input.nameOriginal, input.sourceLanguage, targetLanguage)
        : input.nameOriginal;

      const translatedDescription = input.descriptionOriginal?.trim()
        ? shouldTranslate
          ? await translateText(input.descriptionOriginal, input.sourceLanguage, targetLanguage)
          : input.descriptionOriginal
        : null;

      await client.productTranslation.upsert({
        where: {
          product_id_language: {
            product_id: input.productId,
            language: targetLanguage,
          },
        },
        update: {
          name: translatedName,
          description: translatedDescription,
          is_auto: shouldTranslate,
        },
        create: {
          product_id: input.productId,
          language: targetLanguage,
          name: translatedName,
          description: translatedDescription,
          is_auto: shouldTranslate,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[i18n][product] auto translation failed", {
          productId: input.productId,
          targetLanguage,
          error,
        });
      }
    }
  }
}
