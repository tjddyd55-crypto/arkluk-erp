"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewBuyerCollaborationProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/buyer/collaboration/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status: "OPEN" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "생성 실패");
      }
      router.push(`/buyer/collaboration/projects/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <Link href="/buyer/collaboration/projects" className="text-sm text-gray-400 hover:underline">
        ← 목록
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-white">협업 프로젝트 생성</h1>
      <form className="mt-4 max-w-xl space-y-3" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-300">제목</label>
          <input
            className="mt-1 w-full rounded border border-[#2d333d] px-2 py-1 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">설명</label>
          <textarea
            className="mt-1 w-full rounded border border-[#2d333d] px-2 py-1 text-sm"
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "저장 중…" : "생성"}
        </button>
      </form>
      <p className="mt-6 max-w-xl text-xs text-gray-400">
        파일 첨부는 프로젝트 상세 화면에서 presign 업로드로 추가할 수 있습니다.
      </p>
    </div>
  );
}
