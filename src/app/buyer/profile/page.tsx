"use client";

import { useEffect, useState } from "react";

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
  const [profile, setProfile] = useState<MeResponse["data"]>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/auth/me");
      const result = (await response.json()) as MeResponse;
      if (!response.ok || !result.success || !result.data) {
        setError(result.message ?? "프로필 조회 실패");
        return;
      }
      setProfile(result.data);
    }
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">내 프로필</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p>이름: {profile?.name ?? "-"}</p>
        <p>로그인 ID: {profile?.loginId ?? "-"}</p>
        <p>역할: {profile?.role ?? "-"}</p>
        <p>국가 ID: {profile?.countryId ?? "-"}</p>
      </div>
    </div>
  );
}
