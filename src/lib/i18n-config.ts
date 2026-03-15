export const SUPPORTED_LANGUAGES = ["ko", "en", "mn", "ar"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const I18N_NAMESPACES = [
  "common",
  "dashboard",
  "orders",
  "products",
  "suppliers",
  "profile",
] as const;
export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export function detectLanguageFromBrowser(navigatorLanguage?: string | null): SupportedLanguage {
  const lang = (navigatorLanguage ?? "").toLowerCase();
  if (lang.startsWith("ko")) {
    return "ko";
  }
  if (lang.startsWith("mn")) {
    return "mn";
  }
  if (lang.startsWith("ar")) {
    return "ar";
  }
  return "en";
}
