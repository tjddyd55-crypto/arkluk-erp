"use client";

import { AdminProductReview } from "@/components/portal/admin-product-review";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminProductApprovalsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("product_approval")}</h1>
      <p className="text-sm text-slate-600">{t("products")}</p>
      <AdminProductReview />
    </div>
  );
}
