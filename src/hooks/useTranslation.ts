"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getCurrentLanguage,
  setLanguage as setUiLanguage,
  subscribeLanguage,
  translate,
  type SupportedLanguage,
} from "@/lib/i18n";

export function useTranslation() {
  const [language, setLanguageState] = useState<SupportedLanguage>(getCurrentLanguage());

  useEffect(() => {
    const unsubscribe = subscribeLanguage(() => {
      setLanguageState(getCurrentLanguage());
    });
    setUiLanguage(getCurrentLanguage(), { persist: false });
    return unsubscribe;
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
