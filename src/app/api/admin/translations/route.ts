import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { handleRouteError, HttpError, ok } from "@/lib/http";
import { loadAllLocaleNamespaces, writeLocaleNamespace } from "@/lib/i18n-file-store";
import { I18N_NAMESPACES, SUPPORTED_LANGUAGES } from "@/lib/i18n-config";

const namespaceSchema = z.enum(I18N_NAMESPACES);

const updateTranslationRowSchema = z.object({
  namespace: namespaceSchema,
  key: z.string().min(1),
  translations: z.object({
    ko: z.string(),
    en: z.string(),
    mn: z.string(),
    ar: z.string(),
  }),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, [Role.SUPER_ADMIN, Role.ADMIN, Role.KOREA_SUPPLY_ADMIN]);

    const allLocales = await loadAllLocaleNamespaces();
    const rows: Array<{
      namespace: z.infer<typeof namespaceSchema>;
      key: string;
      translations: Record<(typeof SUPPORTED_LANGUAGES)[number], string>;
    }> = [];

    for (const namespace of I18N_NAMESPACES) {
      const keySet = new Set<string>();
      for (const language of SUPPORTED_LANGUAGES) {
        for (const key of Object.keys(allLocales[language][namespace])) {
          keySet.add(key);
        }
      }

      for (const key of [...keySet].sort()) {
        rows.push({
          namespace,
          key,
          translations: {
            ko: allLocales.ko[namespace][key] ?? "",
            en: allLocales.en[namespace][key] ?? "",
            mn: allLocales.mn[namespace][key] ?? "",
            ar: allLocales.ar[namespace][key] ?? "",
          },
        });
      }
    }

    return ok({
      languages: SUPPORTED_LANGUAGES,
      namespaces: I18N_NAMESPACES,
      rows,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth(request, [Role.SUPER_ADMIN, Role.ADMIN, Role.KOREA_SUPPLY_ADMIN]);

    const body = await request.json().catch(() => null);
    const parsed = updateTranslationRowSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "번역 업데이트 요청 형식이 올바르지 않습니다.");
    }

    const { namespace, key, translations } = parsed.data;
    const allLocales = await loadAllLocaleNamespaces();

    for (const language of SUPPORTED_LANGUAGES) {
      const dictionary = allLocales[language][namespace];
      dictionary[key] = translations[language];
      await writeLocaleNamespace(language, namespace, dictionary);
    }

    return ok({
      namespace,
      key,
      translations,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
