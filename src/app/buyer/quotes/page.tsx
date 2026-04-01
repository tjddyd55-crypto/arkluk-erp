"use client";

import { ApiTable } from "@/components/portal/api-table";
import { useTranslation } from "@/hooks/useTranslation";

export default function BuyerQuotesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("quotes")}</h1>
      <p className="text-sm text-gray-400">{t("quotes")}</p>
      <ApiTable endpoint="/api/buyer/quotes" title={t("quotes")} />
    </div>
  );
}
