"use client";

import { AdminUserManagement } from "@/components/portal/admin-user-management";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminUsersPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("users")}</h1>
      <p className="text-sm text-gray-400">{t("supplier")}</p>
      <AdminUserManagement />
    </div>
  );
}
