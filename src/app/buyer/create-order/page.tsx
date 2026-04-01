"use client";

import { BuyerOrderEntry } from "@/components/portal/buyer-order-entry";
import { useTranslation } from "@/hooks/useTranslation";

export default function BuyerCreateOrderPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("create_order")}</h1>
      <p className="text-sm text-gray-400">{t("orders")}</p>
      <BuyerOrderEntry />
    </div>
  );
}
