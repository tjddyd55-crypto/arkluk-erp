"use client";

import { BuyerProjectsList } from "@/components/portal/buyer-projects-list";
import { useTranslation } from "@/hooks/useTranslation";

export default function BuyerProjectsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("projects")}</h1>
      <p className="text-sm text-gray-400">{t("projects")}</p>
      <BuyerProjectsList />
    </div>
  );
}
