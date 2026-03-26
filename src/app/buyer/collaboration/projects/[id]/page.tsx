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

type Detail = {
  id: number;
  title: string;
  description: string;
  status: string;
  files: FileRow[];
  replies: ReplyRow[];
};

export default function BuyerCollaborationProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upUploading, setUpUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/buyer/collaboration/projects/${id}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message ?? "조회 실패");
    }
    setDetail(json.data as Detail);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "오류");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function uploadOneProjectFile(file: File) {
    const presignRes = await fetch(`/api/buyer/collaboration/projects/${id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        size_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
      }),
    });
    const presignJson = await presignRes.json();
    if (!presignRes.ok || !presignJson.success) {
      throw new Error(presignJson.message ?? `presign 실패: ${file.name}`);
    }
    const { uploadUrl, fileId, expiresIn } = presignJson.data as {
      uploadUrl: string;
      fileId: number;
      expiresIn: number;
    };
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!put.ok) {
      throw new Error(`R2 업로드 실패: ${file.name}`);
    }
    const etag = put.headers.get("etag");
    const completeRes = await fetch(`/api/buyer/collaboration/projects/${id}/files/${fileId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etag: etag?.replaceAll('"', "") ?? null }),
    });
    const completeJson = await completeRes.json();
    if (!completeRes.ok || !completeJson.success) {
      throw new Error(completeJson.message ?? `complete 실패: ${file.name}`);
    }
    return expiresIn;
  }

  async function onPickFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setMsg(null);
    setError(null);
    setUpUploading(true);
    try {
      let lastExpires = 900;
      for (const file of files) {
        lastExpires = await uploadOneProjectFile(file);
      }
      setMsg(files.length > 1 ? `${files.length}개 파일 업로드 완료` : `업로드 완료 (URL 만료 ${lastExpires}s)`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setUpUploading(false);
    }
  }

  async function onDownload(fileId: number) {
    const res = await fetch(`/api/buyer/collaboration/projects/${id}/files/${fileId}/download`);
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
      `/api/buyer/collaboration/projects/${id}/replies/${replyId}/files/${fileId}/download`,
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.message ?? "다운로드 URL 실패");
      return;
    }
    const { downloadUrl } = json.data as { downloadUrl: string };
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">불러오는 중…</div>;
  }
  if (error && !detail) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error}</p>
        <Link href="/buyer/collaboration/projects" className="mt-2 text-sm text-slate-600">
          목록
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div className="p-6">
      <Link href="/buyer/collaboration/projects" className="text-sm text-slate-600 hover:underline">
        ← 목록
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">{detail.title}</h1>
      <p className="mt-1 text-xs text-slate-500">{detail.status}</p>
      <div className="mt-4 whitespace-pre-wrap rounded border border-slate-200 bg-white p-3 text-sm text-slate-800">
        {detail.description}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-900">첨부 파일</h2>
      <div
        className="mt-2 rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onPickFiles(e.dataTransfer.files);
        }}
      >
        <p>파일을 여기에 놓거나 아래에서 선택하세요.</p>
        <input
          type="file"
          multiple
          className="mt-3 block w-full text-sm"
          disabled={upUploading}
          onChange={(e) => void onPickFiles(e.target.files)}
        />
      </div>
      {msg ? <p className="mt-1 text-xs text-emerald-700">{msg}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      <ul className="mt-2 space-y-1 text-sm">
        {detail.files.map((f) => (
          <li key={f.id} className="flex items-center gap-2">
            <span>{f.originalFilename}</span>
            <button type="button" className="text-blue-700 underline" onClick={() => void onDownload(f.id)}>
              다운로드
            </button>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-sm font-semibold text-slate-900">받은 제안</h2>
      <div className="mt-2 space-y-4">
        {detail.replies.map((r) => (
          <div key={r.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
            <p className="text-xs font-medium text-slate-600">
              {r.authorSupplier?.companyName ?? r.authorSupplier?.supplierName ?? "업체"} ·{" "}
              {new Date(r.createdAt).toLocaleString()}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-slate-800">{r.body}</p>
            {r.files.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {r.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span>{f.originalFilename}</span>
                    <button
                      type="button"
                      className="text-blue-700 underline"
                      onClick={() => void onDownloadReplyFile(r.id, f.id)}
                    >
                      다운로드
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
