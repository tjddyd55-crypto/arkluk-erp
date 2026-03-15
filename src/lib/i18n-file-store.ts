import path from "path";
import { promises as fs } from "fs";

import {
  I18N_NAMESPACES,
  SUPPORTED_LANGUAGES,
  type I18nNamespace,
  type SupportedLanguage,
} from "@/lib/i18n-config";

type TranslationDictionary = Record<string, string>;

function localesRootPath() {
  return path.join(process.cwd(), "locales");
}

function localeFilePath(language: SupportedLanguage, namespace: I18nNamespace) {
  return path.join(localesRootPath(), language, `${namespace}.json`);
}

export async function readLocaleNamespace(language: SupportedLanguage, namespace: I18nNamespace) {
  const filePath = localeFilePath(language, namespace);
  const source = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(source) as TranslationDictionary;
  return parsed;
}

export async function writeLocaleNamespace(
  language: SupportedLanguage,
  namespace: I18nNamespace,
  dictionary: TranslationDictionary,
) {
  const filePath = localeFilePath(language, namespace);
  const normalized = Object.fromEntries(
    Object.entries(dictionary).map(([key, value]) => [key, String(value)]),
  );
  await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
}

export async function loadAllLocaleNamespaces() {
  const result: Record<SupportedLanguage, Record<I18nNamespace, TranslationDictionary>> =
    {} as Record<SupportedLanguage, Record<I18nNamespace, TranslationDictionary>>;

  for (const language of SUPPORTED_LANGUAGES) {
    result[language] = {} as Record<I18nNamespace, TranslationDictionary>;
    for (const namespace of I18N_NAMESPACES) {
      result[language][namespace] = await readLocaleNamespace(language, namespace);
    }
  }

  return result;
}
