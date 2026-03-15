"use client";

import { AdminUserManagement } from "@/components/portal/admin-user-management";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminUsersPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("users")}</h1>
      <p className="text-sm text-slate-600">{t("supplier")}</p>
      <AdminUserManagement />
    </div>
  );
}
