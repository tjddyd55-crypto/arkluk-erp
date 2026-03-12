"use client";

import { useParams } from "next/navigation";

import { AdminProjectDetail } from "@/components/portal/admin-project-detail";

export default function AdminProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  if (Number.isNaN(projectId)) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">유효하지 않은 프로젝트 ID입니다.</p>;
  }

  return <AdminProjectDetail projectId={projectId} />;
}
