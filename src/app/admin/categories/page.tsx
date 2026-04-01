"use client";

import { ApiTable } from "@/components/portal/api-table";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminCategoriesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("categories")}</h1>
      <p className="text-sm text-gray-400">{t("supplier")}</p>
      <ApiTable endpoint="/api/admin/categories" title={t("categories")} />
    </div>
  );
}
