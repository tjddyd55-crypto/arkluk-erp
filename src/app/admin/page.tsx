"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    async function routeByRole() {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();
        const role = result?.data?.role as string | undefined;
        if (role === "KOREA_SUPPLY_ADMIN" || role === "ADMIN") {
          router.replace("/admin/supply-dashboard");
          return;
        }
      } catch {
        // fallback
      }
      router.replace("/admin/dashboard");
    }
    routeByRole();
  }, [router]);

  return <p className="text-sm text-slate-500">대시보드로 이동 중...</p>;
}
