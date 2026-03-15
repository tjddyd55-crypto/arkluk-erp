"use client";

import { useParams } from "next/navigation";

import { AdminProjectDetail } from "@/components/portal/admin-project-detail";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminProjectDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  if (Number.isNaN(projectId)) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{t("error")}</p>;
  }

  return <AdminProjectDetail projectId={projectId} />;
}
