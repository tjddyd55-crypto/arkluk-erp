"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@/hooks/useTranslation";
import type { SupportedLanguage } from "@/lib/i18n";

type AuthMeResponse = {
  success: boolean;
  data?: {
    id: number;
    loginId: string;
    name: string;
    role: string;
    countryId: number | null;
    supplierId: number | null;
    language: SupportedLanguage;
    email: string | null;
    contactPhone: string | null;
  } | null;
  message?: string;
};

export function UserProfileSettings() {
  const { t, language, setLanguage } = useTranslation();
  const [profile, setProfile] = useState<AuthMeResponse["data"]>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(language);
  const [email, setEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setError(null);
      try {
        const response = await fetch("/api/auth/me");
        const result = (await response.json()) as AuthMeResponse;
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? t("error"));
        }
        setProfile(result.data);
        setSelectedLanguage(result.data.language);
        setEmail(result.data.email ?? "");
        setContactPhone(result.data.contactPhone ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : t("error"));
      }
    }
    loadProfile();
  }, [t]);

  async function saveProfileSettings() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: selectedLanguage,
          email: email.trim() ? email.trim() : null,
          contactPhone: contactPhone.trim() ? contactPhone.trim() : null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setLanguage(selectedLanguage, { persist: false });
      setMessage(t("success"));
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              language: selectedLanguage,
              email: email.trim() ? email.trim() : null,
              contactPhone: contactPhone.trim() ? contactPhone.trim() : null,
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{error}</p> : null}
      {message ? <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

      <section className="rounded-lg border border-[#2d333d] bg-[#1a1d23] p-4 text-sm">
        <p>
          {t("name")}: {profile?.name ?? "-"}
        </p>
        <p>
          {t("login_id")}: {profile?.loginId ?? "-"}
        </p>
        <p>
          {t("status")}: {profile?.role ?? "-"}
        </p>
        <p>
          {t("country")}: {profile?.countryId ?? "-"}
        </p>
      </section>

      <section className="rounded-lg border border-[#2d333d] bg-[#1a1d23] p-4 text-sm">
        <h2 className="text-base font-semibold text-white">{t("language")}</h2>
        <p className="mt-1 text-xs text-gray-400">
          저장하면 이후 로그인에서도 같은 기본 언어로 표시됩니다.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="text-sm text-gray-300">
            Email
            <input
              className="mt-1 w-full rounded border border-[#2d333d] px-2 py-1 text-sm"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@domain.com"
              disabled={pending}
            />
          </label>
          <label className="text-sm text-gray-300">
            Contact
            <input
              className="mt-1 w-full rounded border border-[#2d333d] px-2 py-1 text-sm"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="+82-10-0000-0000"
              disabled={pending}
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-[#2d333d] px-2 py-1 text-sm"
            value={selectedLanguage}
            onChange={(event) => setSelectedLanguage(event.target.value as SupportedLanguage)}
            disabled={pending}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="mn">Монгол</option>
            <option value="ar">العربية</option>
          </select>
          <button
            type="button"
            className="rounded border border-[#2d333d] px-3 py-1 text-sm disabled:opacity-60"
            onClick={saveProfileSettings}
            disabled={pending}
          >
            {pending ? t("loading") : t("save")}
          </button>
        </div>
      </section>
    </div>
  );
}
