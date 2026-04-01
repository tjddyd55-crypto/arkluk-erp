"use client";

import { useTranslation } from "@/hooks/useTranslation";
import type { SupportedLanguage } from "@/lib/i18n";

export function PublicLanguageSwitcher() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <label className="flex items-center gap-2 text-sm text-gray-300">
      <span>🌐 {t("language")}</span>
      <select
        className="rounded-lg border border-[#2d333d] bg-[#1a1d23] px-2 py-1 text-sm text-white"
        value={language}
        onChange={(event) => setLanguage(event.target.value as SupportedLanguage, { persist: true })}
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="mn">Монгол</option>
        <option value="ar">العربية</option>
      </select>
    </label>
  );
}
