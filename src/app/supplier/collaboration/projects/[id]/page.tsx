"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type FileRow = {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: string;
  uploadStatus: string;
  createdAt: string;
};

type ReplyRow = {
  id: number;
  body: string;
  createdAt: string;
  authorSupplier: { id: number; companyName: string | null; supplierName: string } | null;
  files: FileRow[];
};

type ProjectDetail = {
  id: number;
  title: string;
  description: string;
  status: string;
  files: FileRow[];
};

export default function SupplierCollaborationProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBody, setNewBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [pRes, rRes] = await Promise.all([
      fetch(`/api/supplier/collaboration/projects/${id}`),
      fetch(`/api/supplier/collaboration/projects/${id}/replies`),
    ]);
    const pJson = await pRes.json();
    const rJson = await rRes.json();
    if (!pRes.ok || !pJson.success) {
      throw new Error(pJson.message ?? "프로젝트 조회 실패");
    }
    if (!rRes.ok || !rJson.success) {
      throw new Error(rJson.message ?? "답글 조회 실패");
    }
    setProject(pJson.data as ProjectDetail);
    setReplies(rJson.data as ReplyRow[]);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadAll();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "오류");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  async function onDownloadProjectFile(fileId: number) {
    const res = await fetch(`/api/supplier/collaboration/projects/${id}/files/${fileId}/download`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.message ?? "다운로드 URL 실패");
      return;
    }
    const { downloadUrl } = json.data as { downloadUrl: string };
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function onDownloadReplyFile(replyId: number, fileId: number) {
    const res = await fetch(
      `/api/supplier/collaboration/projects/${id}/replies/${replyId}/files/${fileId}/download`,
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.message ?? "다운로드 URL 실패");
      return;
    }
    const { downloadUrl } = json.data as { downloadUrl: string };
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function onCreateReply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/supplier/collaboration/projects/${id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newBody }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "등록 실패");
      }
      setNewBody("");
      setMsg("제안이 등록되었습니다.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadOneReplyFile(replyId: number, file: File) {
    const presignRes = await fetch(
      `/api/supplier/collaboration/projects/${id}/replies/${replyId}/files/presign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          size_bytes: file.size,
          mime_type: file.type || "application/octet-stream",
        }),
      },
    );
    const presignJson = await presignRes.json();
    if (!presignRes.ok || !presignJson.success) {
      throw new Error(presignJson.message ?? `presign 실패: ${file.name}`);
    }
    const { uploadUrl, fileId } = presignJson.data as { uploadUrl: string; fileId: number };
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!put.ok) {
      throw new Error(`R2 업로드 실패: ${file.name}`);
    }
    const etag = put.headers.get("etag");
    const completeRes = await fetch(
      `/api/supplier/collaboration/projects/${id}/replies/${replyId}/files/${fileId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etag: etag?.replaceAll('"', "") ?? null }),
      },
    );
    const completeJson = await completeRes.json();
    if (!completeRes.ok || !completeJson.success) {
      throw new Error(completeJson.message ?? `complete 실패: ${file.name}`);
    }
  }

  async function uploadReplyFiles(replyId: number, fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setError(null);
    setMsg(null);
    setUploadingKey(`${replyId}-${files.map((f) => f.name).join(",")}`);
    try {
      for (const file of files) {
        await uploadOneReplyFile(replyId, file);
      }
      setMsg(files.length > 1 ? `${files.length}개 첨부 업로드 완료` : "첨부 업로드 완료");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setUploadingKey(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">불러오는 중&hellip;</div>;
  }
  if (error && !project) {
    return (
      <div className="p-6">
        <p className="text-red-400">{error}</p>
        <Link href="/supplier/collaboration/projects" className="mt-2 text-sm text-gray-400">
          목록
        </Link>
      </div>
    );
  }
  if (!project) return null;

  return (
    <div className="p-6">
      <Link href="/supplier/collaboration/projects" className="text-sm text-gray-400 hover:underline">
        &larr; 목록
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-white">{project.title}</h1>
      <p className="mt-1 text-xs text-gray-400">{project.status}</p>
      <div className="mt-4 whitespace-pre-wrap rounded border border-[#2d333d] bg-[#1a1d23] p-3 text-sm text-gray-300">
        {project.description}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-white">바이어 첨부</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {project.files.map((f) => (
          <li key={f.id} className="flex items-center gap-2">
            <span>{f.originalFilename}</span>
            <button type="button" className="text-blue-400 underline" onClick={() => void onDownloadProjectFile(f.id)}>
              다운로드
            </button>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-sm font-semibold text-white">내 제안</h2>
      <form className="mt-2 max-w-2xl space-y-2 rounded border border-[#2d333d] bg-[#111318] p-3" onSubmit={onCreateReply}>
        <label className="block text-xs font-medium text-gray-300">새 제안 본문</label>
        <textarea
          className="w-full rounded border border-[#2d333d] px-2 py-1 text-sm"
          rows={5}
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "등록 중&hellip;" : "제안 등록"}
        </button>
      </form>

      {msg ? <p className="mt-2 text-xs text-emerald-700">{msg}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

      <div className="mt-6 space-y-5">
        {replies.map((r) => (
          <div key={r.id} className="rounded border border-[#2d333d] bg-[#1a1d23] p-3 text-sm">
            <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</p>
            <p className="mt-2 whitespace-pre-wrap text-gray-300">{r.body}</p>
            <ul className="mt-2 space-y-1">
              {r.files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-xs">
                  <span>{f.originalFilename}</span>
                  <button
                    type="button"
                    className="text-blue-400 underline"
                    onClick={() => void onDownloadReplyFile(r.id, f.id)}
                  >
                    다운로드
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <label className="text-xs text-gray-400">이 제안에 파일 추가</label>
              <div
                className="mt-1 rounded border border-dashed border-[#2d333d] bg-[#111318] p-3 text-center text-xs text-gray-400"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void uploadReplyFiles(r.id, e.dataTransfer.files);
                }}
              >
                드래그 앤 드롭 또는 선택
                <input
                  type="file"
                  multiple
                  className="mt-2 block w-full text-xs"
                  disabled={uploadingKey !== null}
                  onChange={(e) => {
                    void uploadReplyFiles(r.id, e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
