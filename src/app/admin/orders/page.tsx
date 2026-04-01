"use client";

import { AdminOrdersList } from "@/components/portal/admin-orders-list";
import { AdminCentralReviewDashboard } from "@/components/portal/admin-central-review-dashboard";
import { AssignmentSettingsPanel } from "@/components/portal/assignment-settings-panel";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminOrdersPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("orders")}</h1>
      <p className="text-sm text-gray-400">{t("view_only_policy")}</p>
      <AssignmentSettingsPanel />
      <AdminCentralReviewDashboard />
      <AdminOrdersList />
    </div>
  );
}
