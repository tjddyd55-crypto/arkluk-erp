"use client";

import { useEffect, useState } from "react";

type ProjectRow = {
  id: number;
  project_name: string;
  status: "DRAFT" | "QUOTING" | "QUOTED" | "ORDERING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  created_at: string;
  country: { country_name: string };
  _count: { quotes: number; orders: number; files: number };
};

const statusLabel: Record<ProjectRow["status"], string> = {
  DRAFT: "초안",
  QUOTING: "견적 작성중",
  QUOTED: "견적 발송",
  ORDERING: "주문 진행",
  ACTIVE: "발주 진행",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

export function BuyerProjectsList() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");

  async function loadProjects() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (status) params.set("status", status);

      const response = await fetch(`/api/buyer/projects?${params.toString()}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "프로젝트 목록 조회 실패");
      }
      setProjects(result.data as ProjectRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로젝트 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="프로젝트명 검색"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">전체 상태</option>
          {Object.entries(statusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-sm"
          onClick={loadProjects}
        >
          조회
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-500">프로젝트 목록을 불러오는 중...</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      {!loading && !error ? (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">프로젝트명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">국가</th>
                <th className="border border-slate-200 px-2 py-1 text-left">최근 견적</th>
                <th className="border border-slate-200 px-2 py-1 text-left">최근 주문</th>
                <th className="border border-slate-200 px-2 py-1 text-left">생성일</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    <a className="text-blue-700 underline" href={`/buyer/projects/${project.id}`}>
                      {project.project_name}
                    </a>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{statusLabel[project.status]}</td>
                  <td className="border border-slate-200 px-2 py-1">{project.country.country_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{project._count.quotes}</td>
                  <td className="border border-slate-200 px-2 py-1">{project._count.orders}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(project.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-slate-200 px-2 py-3 text-center text-slate-500">
                    조회된 프로젝트가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
