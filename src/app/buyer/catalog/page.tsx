"use client";

import { BuyerProductCatalog } from "@/components/portal/buyer-product-catalog";
import { useTranslation } from "@/hooks/useTranslation";

export default function BuyerCatalogPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("products")}</h1>
      <p className="text-sm text-gray-400">{t("country")}</p>
      <BuyerProductCatalog />
    </div>
  );
}
