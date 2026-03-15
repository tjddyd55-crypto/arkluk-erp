"use client";

import { TaxInvoiceMailbox } from "@/components/portal/tax-invoice-mailbox";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminTaxInvoicesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("tax_invoices")}</h1>
      <p className="text-sm text-slate-600">{t("tax_invoices")}</p>
      <TaxInvoiceMailbox />
    </div>
  );
}
