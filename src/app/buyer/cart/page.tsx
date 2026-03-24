"use client";

import { BuyerCartView } from "@/components/portal/buyer-cart-view";
import { useTranslation } from "@/hooks/useTranslation";

export default function BuyerCartPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("buyer_cart_menu")}</h1>
      <p className="text-sm text-slate-600">{t("buyer_cart_hint")}</p>
      <BuyerCartView />
    </div>
  );
}
