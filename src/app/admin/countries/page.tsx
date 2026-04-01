"use client";

import { ApiTable } from "@/components/portal/api-table";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminCountriesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("countries")}</h1>
      <p className="text-sm text-gray-400">{t("country")}</p>
      <ApiTable endpoint="/api/admin/countries" title={t("countries")} />
    </div>
  );
}
