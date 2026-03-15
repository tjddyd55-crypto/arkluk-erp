"use client";

import { PurchaseOrderTemplateManager } from "@/components/portal/purchase-order-template-manager";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminPurchaseOrderTemplatesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("purchase_order_templates")}</h1>
      <p className="text-sm text-slate-600">{t("purchase_order_templates")}</p>
      <PurchaseOrderTemplateManager />
    </div>
  );
}
