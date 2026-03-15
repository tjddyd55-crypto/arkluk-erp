"use client";

import { ApiTable } from "@/components/portal/api-table";
import { useTranslation } from "@/hooks/useTranslation";

export default function SupplierQuotesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("quotes")}</h1>
      <p className="text-sm text-slate-600">{t("my_quotes")}</p>
      <ApiTable endpoint="/api/supplier/quotes" title={t("my_quotes")} />
    </div>
  );
}
