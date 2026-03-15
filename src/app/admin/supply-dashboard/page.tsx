"use client";

import { KoreaSupplyDashboard } from "@/components/portal/korea-supply-dashboard";
import { useTranslation } from "@/hooks/useTranslation";

export default function KoreaSupplyAdminDashboardPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("role_supply_admin_dashboard")}</h1>
      <p className="text-sm text-slate-600">{t("view_only_policy")}</p>
      <KoreaSupplyDashboard />
    </div>
  );
}
