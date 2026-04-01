"use client";

import { SuperAdminDashboard } from "@/components/portal/super-admin-dashboard";
import { useTranslation } from "@/hooks/useTranslation";

export default function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("role_super_admin_dashboard")}</h1>
      <p className="text-sm text-gray-400">{t("view_only_policy")}</p>
      <SuperAdminDashboard />
    </div>
  );
}
