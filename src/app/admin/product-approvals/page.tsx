"use client";

import { AdminProductReview } from "@/components/portal/admin-product-review";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminProductApprovalsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("product_approval")}</h1>
      <p className="text-sm text-gray-400">{t("products")}</p>
      <AdminProductReview />
    </div>
  );
}
