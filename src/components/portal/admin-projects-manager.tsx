"use client";

import { useEffect, useMemo, useState } from "react";

type Country = {
  id: number;
  country_name: string;
};

type User = {
  id: number;
  name: string;
  role: string;
  country_id: number | null;
};

type ProjectRow = {
  id: number;
  project_name: string;
  status: "DRAFT" | "QUOTING" | "QUOTED" | "ORDERING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  created_at: string;
  buyer: { id: number; name: string };
  country: { id: number; country_name: string };
  _count: { quotes: number; orders: number; files: number };
};

const statusOptions: Array<ProjectRow["status"]> = [
  "DRAFT",
  "QUOTING",
  "QUOTED",
  "ORDERING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
];

const statusLabel: Record<ProjectRow["status"], string> = {
  DRAFT: "초안",
  QUOTING: "견적 작성중",
  QUOTED: "견적 발송",
  ORDERING: "주문 진행",
  ACTIVE: "발주 진행",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

type CreateForm = {
  projectName: string;
  buyerId: string;
  countryId: string;
  memo: string;
  location: string;
  startDate: string;
  endDate: string;
};

const initialCreateForm: CreateForm = {
  projectName: "",
  buyerId: "",
  countryId: "",
  memo: "",
  location: "",
  startDate: "",
  endDate: "",
};

export function AdminProjectsManager() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [buyers, setBuyers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [countryId, setCountryId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [createForm, setCreateForm] = useState<CreateForm>(initialCreateForm);

  const buyerOptions = useMemo(
    () => buyers.filter((user) => user.role === "BUYER"),
    [buyers],
  );

  async function loadMasters() {
    const [countriesResponse, usersResponse] = await Promise.all([
      fetch("/api/admin/countries"),
      fetch("/api/admin/users"),
    ]);
    const countriesResult = await countriesResponse.json();
    const usersResult = await usersResponse.json();
    if (!countriesResponse.ok || !countriesResult.success) {
      throw new Error(countriesResult.message ?? "국가 목록 조회 실패");
    }
    if (!usersResponse.ok || !usersResult.success) {
      throw new Error(usersResult.message ?? "사용자 목록 조회 실패");
    }

    setCountries(countriesResult.data as Country[]);
    setBuyers(usersResult.data as User[]);
  }

  async function loadProjects() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (status) params.set("status", status);
      if (countryId) params.set("countryId", countryId);
      if (buyerId) params.set("buyerId", buyerId);

      const response = await fetch(`/api/admin/projects?${params.toString()}`);
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
    async function bootstrap() {
      try {
        await loadMasters();
        await loadProjects();
      } catch (err) {
        setError(err instanceof Error ? err.message : "초기 데이터 조회 실패");
        setLoading(false);
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (!createForm.projectName.trim() || !createForm.buyerId || !createForm.countryId) {
        throw new Error("프로젝트명/바이어/국가를 입력하세요.");
      }

      const response = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: createForm.projectName.trim(),
          buyerId: Number(createForm.buyerId),
          countryId: Number(createForm.countryId),
          memo: createForm.memo.trim() || null,
          location: createForm.location.trim() || null,
          startDate: createForm.startDate || null,
          endDate: createForm.endDate || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "프로젝트 생성 실패");
      }

      setMessage("프로젝트를 생성했습니다.");
      setCreateForm(initialCreateForm);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로젝트 생성 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">프로젝트 생성</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={onCreateProject}>
          <label className="text-sm text-slate-700">
            프로젝트명
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={createForm.projectName}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, projectName: event.target.value }))
              }
            />
          </label>
          <label className="text-sm text-slate-700">
            바이어
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={createForm.buyerId}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, buyerId: event.target.value }))
              }
            >
              <option value="">선택</option>
              {buyerOptions.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            국가
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={createForm.countryId}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, countryId: event.target.value }))
              }
            >
              <option value="">선택</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.country_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            현장 위치
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={createForm.location}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, location: event.target.value }))
              }
            />
          </label>
          <label className="text-sm text-slate-700">
            시작일
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={createForm.startDate}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, startDate: event.target.value }))
              }
            />
          </label>
          <label className="text-sm text-slate-700">
            종료일
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={createForm.endDate}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, endDate: event.target.value }))
              }
            />
          </label>
          <label className="text-sm text-slate-700 md:col-span-2">
            메모
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              rows={3}
              value={createForm.memo}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, memo: event.target.value }))
              }
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "생성 중..." : "프로젝트 생성"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
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
            {statusOptions.map((value) => (
              <option key={value} value={value}>
                {statusLabel[value]}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={countryId}
            onChange={(event) => setCountryId(event.target.value)}
          >
            <option value="">전체 국가</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.country_name}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={buyerId}
            onChange={(event) => setBuyerId(event.target.value)}
          >
            <option value="">전체 바이어</option>
            {buyerOptions.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>
                {buyer.name}
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

        {loading ? <p className="mt-3 text-sm text-slate-500">프로젝트 목록을 불러오는 중...</p> : null}
        {error ? <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}

        {!loading && !error ? (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-2 py-1 text-left">프로젝트명</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">바이어</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">국가</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">견적/주문</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">생성일</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td className="border border-slate-200 px-2 py-1">
                      <a className="text-blue-700 underline" href={`/admin/projects/${project.id}`}>
                        {project.project_name}
                      </a>
                    </td>
                    <td className="border border-slate-200 px-2 py-1">{project.buyer.name}</td>
                    <td className="border border-slate-200 px-2 py-1">{project.country.country_name}</td>
                    <td className="border border-slate-200 px-2 py-1">{statusLabel[project.status]}</td>
                    <td className="border border-slate-200 px-2 py-1">
                      {project._count.quotes} / {project._count.orders}
                    </td>
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
    </div>
  );
}
