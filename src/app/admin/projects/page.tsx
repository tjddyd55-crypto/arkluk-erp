"use client";

import { AdminProjectsManager } from "@/components/portal/admin-projects-manager";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminProjectsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("projects")}</h1>
      <p className="text-sm text-slate-600">{t("projects")}</p>
      <AdminProjectsManager />
    </div>
  );
}
