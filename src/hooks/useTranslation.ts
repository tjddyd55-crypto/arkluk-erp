"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  getCurrentLanguage,
  setLanguage as setUiLanguage,
  subscribeLanguage,
  translate,
  type SupportedLanguage,
} from "@/lib/i18n";

export function useTranslation() {
  const language = useSyncExternalStore<SupportedLanguage>(
    subscribeLanguage,
    getCurrentLanguage,
    () => "en",
  );

  useEffect(() => {
    setUiLanguage(getCurrentLanguage(), { persist: false });
    return undefined;
  }, []);

  const t = useCallback((key: string) => translate(key), []);

  const setLanguage = useCallback(
    (lang: SupportedLanguage, options?: { persist?: boolean }) => {
      setUiLanguage(lang, options);
    },
    [],
  );

  return useMemo(
    () => ({
      t,
      language,
      setLanguage,
      isRTL: language === "ar",
    }),
    [language, setLanguage, t],
  );
}
