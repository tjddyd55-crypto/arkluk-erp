"use client";

import { Suspense } from "react";

import { BuyerShopOrder } from "@/components/portal/buyer-shop-order";
import { useTranslation } from "@/hooks/useTranslation";

export default function BuyerShopPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("buyer_shop_order")}</h1>
      <p className="text-sm text-slate-600">{t("buyer_shop_hint")}</p>
      <Suspense fallback={<p className="text-sm text-slate-500">{t("loading")}</p>}>
        <BuyerShopOrder />
      </Suspense>
    </div>
  );
}
