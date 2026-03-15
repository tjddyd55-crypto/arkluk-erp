"use client";

import { ApiTable } from "@/components/portal/api-table";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminQuotesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("quotes")}</h1>
      <p className="text-sm text-slate-600">{t("supplier")}</p>
      <ApiTable endpoint="/api/admin/quotes" title={t("quotes")} />
    </div>
  );
}
