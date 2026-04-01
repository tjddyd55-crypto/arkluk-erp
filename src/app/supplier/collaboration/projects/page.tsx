"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  sampleFiles: { id: number; originalFilename: string }[];
};

export default function SupplierCollaborationProjectsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/supplier/collaboration/projects");
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
      <h1 className="text-xl font-semibold text-white">협업 프로젝트</h1>
      <p className="mt-1 text-sm text-gray-400">OPEN 상태의 프로젝트만 열람할 수 있습니다.</p>
      {loading ? <p className="mt-4 text-sm text-gray-400">불러오는 중&hellip;</p> : null}
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">열람 가능한 프로젝트가 없습니다.</p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded border border-[#2d333d] bg-[#1a1d23] p-3">
            <Link href={`/supplier/collaboration/projects/${r.id}`} className="font-medium text-white hover:underline">
              {r.title}
            </Link>
            <p className="mt-1 line-clamp-2 text-xs text-gray-400">{r.description}</p>
            <p className="mt-1 text-xs text-gray-400">
              {r.status} · {new Date(r.createdAt).toLocaleString()}
              {r.sampleFiles.length > 0 ? ` · 첨부 샘플 ${r.sampleFiles.length}건` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
