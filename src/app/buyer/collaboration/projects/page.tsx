"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  fileCount: number;
};

export default function BuyerCollaborationProjectsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/buyer/collaboration/projects");
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message ?? "목록 조회 실패");
        }
        if (!cancelled) {
          setRows(json.data as Row[]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "오류");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">협업 프로젝트</h1>
        <Link
          href="/buyer/collaboration/projects/new"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
        >
          새 프로젝트
        </Link>
      </div>
      {loading ? <p className="text-sm text-gray-400">불러오는 중…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="text-sm text-gray-400">등록된 협업 프로젝트가 없습니다.</p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded border border-[#2d333d] bg-[#1a1d23] p-3">
            <Link href={`/buyer/collaboration/projects/${r.id}`} className="font-medium text-white hover:underline">
              {r.title}
            </Link>
            <p className="mt-1 text-xs text-gray-400">
              {r.status} · 첨부 {r.fileCount} · {new Date(r.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
