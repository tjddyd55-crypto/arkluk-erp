"use client";

import { useParams } from "next/navigation";

import { BuyerProjectDetail } from "@/components/portal/buyer-project-detail";

export default function BuyerProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  if (Number.isNaN(projectId)) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">유효하지 않은 프로젝트 ID입니다.</p>;
  }

  return <BuyerProjectDetail projectId={projectId} />;
}
