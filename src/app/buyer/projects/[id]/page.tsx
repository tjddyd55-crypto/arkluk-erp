"use client";

import { useParams } from "next/navigation";

import { BuyerProjectDetail } from "@/components/portal/buyer-project-detail";
import { useTranslation } from "@/hooks/useTranslation";

export default function BuyerProjectDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  if (Number.isNaN(projectId)) {
    return <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{t("error")}</p>;
  }

  return <BuyerProjectDetail projectId={projectId} />;
}
