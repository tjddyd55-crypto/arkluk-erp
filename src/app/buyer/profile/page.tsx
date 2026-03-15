"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

type MeResponse = {
  success: boolean;
  data?: {
    id: number;
    loginId: string;
    name: string;
    role: string;
    countryId: number | null;
  } | null;
  message?: string;
};

export default function BuyerProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<MeResponse["data"]>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/auth/me");
      const result = (await response.json()) as MeResponse;
      if (!response.ok || !result.success || !result.data) {
        setError(result.message ?? t("error"));
        return;
      }
      setProfile(result.data);
    }
    load();
  }, [t]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("profile")}</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p>{t("name")}: {profile?.name ?? "-"}</p>
        <p>{t("login_id")}: {profile?.loginId ?? "-"}</p>
        <p>{t("status")}: {profile?.role ?? "-"}</p>
        <p>{t("country")}: {profile?.countryId ?? "-"}</p>
      </div>
    </div>
  );
}
