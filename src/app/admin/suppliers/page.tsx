"use client";

import { SupplierManagement } from "@/components/portal/supplier-management";
import { SupplierInvoiceSettings } from "@/components/portal/supplier-invoice-settings";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminSuppliersPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("suppliers")}</h1>
      <p className="text-sm text-slate-600">{t("supplier")}</p>
      <SupplierManagement />
      <SupplierInvoiceSettings />
    </div>
  );
}
