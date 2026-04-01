"use client";

import { useEffect, useState } from "react";

type RequestRow = {
  id: number;
  request_title: string;
  requested_field_label: string;
  requested_field_type: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "BOOLEAN" | "DATE";
  request_reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  supplier: {
    id: number;
    supplier_name: string;
    company_name: string | null;
  };
  reviewer?: {
    id: number;
    name: string;
    login_id: string;
  } | null;
};

export function SupplierProductFieldRequestManager() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/product-field-requests");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "필드 요청 조회 실패");
      }
      setRows(result.data as RequestRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "필드 요청 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  async function reviewRequest(requestId: number, status: "APPROVED" | "REJECTED") {
    setProcessingId(requestId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/product-field-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "요청 처리 실패");
      }
      setMessage(status === "APPROVED" ? "요청을 승인했습니다." : "요청을 반려했습니다.");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 처리 실패");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="space-y-3 rounded border border-[#2d333d] bg-[#1a1d23] p-4">
      <h2 className="text-lg font-semibold text-white">공급사 필드 추가 요청</h2>
      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-950/30 p-2 text-sm text-red-400">{error}</p> : null}

      {loading ? <p className="text-sm text-gray-400">요청 목록을 불러오는 중...</p> : null}

      {!loading ? (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                <th className="border border-[#2d333d] px-2 py-1 text-left">공급사</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">요청 제목</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">필드명</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">타입</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">사유</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">상태</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">요청일</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">처리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {row.supplier.company_name ?? row.supplier.supplier_name}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">{row.request_title}</td>
                  <td className="border border-[#2d333d] px-2 py-1">{row.requested_field_label}</td>
                  <td className="border border-[#2d333d] px-2 py-1">{row.requested_field_type}</td>
                  <td className="border border-[#2d333d] px-2 py-1">{row.request_reason}</td>
                  <td className="border border-[#2d333d] px-2 py-1">{row.status}</td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {row.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-60"
                          disabled={processingId === row.id}
                          onClick={() => reviewRequest(row.id, "APPROVED")}
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-400 disabled:opacity-60"
                          disabled={processingId === row.id}
                          onClick={() => reviewRequest(row.id, "REJECTED")}
                        >
                          반려
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {row.reviewer ? `${row.reviewer.name}` : "-"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="border border-[#2d333d] px-2 py-2 text-center text-gray-400" colSpan={8}>
                    요청 데이터가 없습니다.
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
