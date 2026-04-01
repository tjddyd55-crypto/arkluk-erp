"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();

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

  return <p className="text-sm text-gray-400">{t("loading")}</p>;
}
