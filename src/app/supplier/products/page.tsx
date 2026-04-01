"use client";

import { SupplierProductManagement } from "@/components/portal/supplier-product-management";
import { useTranslation } from "@/hooks/useTranslation";

export default function SupplierProductsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 text-gray-300">
      <h1 className="text-2xl font-bold text-white">{t("products")}</h1>
      <p className="text-sm text-gray-400">{t("my_products")}</p>
      <SupplierProductManagement />
    </div>
  );
}
