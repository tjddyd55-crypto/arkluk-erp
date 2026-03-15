"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";
import { useTranslation } from "@/hooks/useTranslation";
import type { SupportedLanguage } from "@/lib/i18n";

type LoginResponse = {
  success: boolean;
  data?: {
    role:
      | "SUPER_ADMIN"
      | "KOREA_SUPPLY_ADMIN"
      | "COUNTRY_ADMIN"
      | "ADMIN"
      | "BUYER"
      | "SUPPLIER";
    language: SupportedLanguage;
  };
  message?: string;
};

function routeByRole(
  role:
    | "SUPER_ADMIN"
    | "KOREA_SUPPLY_ADMIN"
    | "COUNTRY_ADMIN"
    | "ADMIN"
    | "BUYER"
    | "SUPPLIER",
) {
  if (role === "BUYER" || role === "COUNTRY_ADMIN") {
    return "/buyer";
  }
  if (role === "SUPPLIER") {
    return "/supplier";
  }
  return "/admin";
}

export default function LoginPage() {
  const router = useRouter();
  const { t, setLanguage } = useTranslation();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loginId, password }),
      });
      const result = (await response.json()) as LoginResponse;
      if (!response.ok || !result.success || !result.data) {
        setError(result.message ?? t("login_failed"));
        return;
      }
      setLanguage(result.data.language ?? "en", { persist: false });
      router.push(routeByRole(result.data.role));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login_failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="absolute right-6 top-6">
        <PublicLanguageSwitcher />
      </div>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-slate-900">{t("login")}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {t("login_description")}
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{t("login_id")}</span>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{t("password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded bg-slate-900 py-2 text-white disabled:opacity-60"
        >
          {pending ? t("logging_in") : t("login")}
        </button>
      </form>
    </div>
  );
}
