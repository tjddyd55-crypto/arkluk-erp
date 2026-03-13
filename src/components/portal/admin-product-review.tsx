"use client";

import { useEffect, useState } from "react";

type PendingProduct = {
  id: number;
  name: string | null;
  sku: string | null;
  specification: string | null;
  price: string;
  currency: string;
  supplier: { supplier_name: string; company_name: string | null };
  category: { category_name: string };
  created_at: string;
};

export function AdminProductReview() {
  const [rows, setRows] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<number, string>>({});

  async function loadPendingProducts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/products?status=PENDING");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "승인 대기 상품 조회 실패");
      }
      setRows(result.data as PendingProduct[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPendingProducts();
  }, []);

  async function review(productId: number, status: "APPROVED" | "REJECTED", reason?: string) {
    setError(null);
    setMessage(null);

    const rejectReason = reason?.trim() ?? "";
    if (status === "REJECTED" && rejectReason.length === 0) {
      setError("반려 시에는 사유를 입력해야 합니다.");
      return;
    }

    setProcessingId(productId);
    try {
      const response = await fetch(`/api/admin/products/${productId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reason: status === "REJECTED" ? rejectReason : null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "상품 검토 실패");
      }

      setMessage(status === "APPROVED" ? "상품을 승인했습니다." : "상품을 반려했습니다.");
      setRejectReasonMap((prev) => ({ ...prev, [productId]: "" }));
      await loadPendingProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 검토 실패");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">공급사 상품 승인 대기</h2>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-sm"
          onClick={loadPendingProducts}
        >
          새로고침
        </button>
      </div>

      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">승인 대기 상품을 불러오는 중...</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                <th className="border border-slate-200 px-2 py-1 text-left">카테고리</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상품명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">SKU</th>
                <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
                <th className="border border-slate-200 px-2 py-1 text-left">가격</th>
                <th className="border border-slate-200 px-2 py-1 text-left">반려 사유</th>
                <th className="border border-slate-200 px-2 py-1 text-left">처리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    {row.supplier.company_name ?? row.supplier.supplier_name}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{row.category.category_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.name ?? "-"}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.sku ?? "-"}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.specification ?? "-"}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {Number(row.price).toLocaleString()} {row.currency}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <input
                      type="text"
                      className="w-56 rounded border border-slate-300 px-2 py-1 text-xs"
                      placeholder="반려 사유 입력"
                      value={rejectReasonMap[row.id] ?? ""}
                      onChange={(event) =>
                        setRejectReasonMap((prev) => ({
                          ...prev,
                          [row.id]: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        onClick={() => review(row.id, "APPROVED")}
                        disabled={processingId === row.id}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        onClick={() => review(row.id, "REJECTED", rejectReasonMap[row.id])}
                        disabled={processingId === row.id}
                      >
                        반려
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={8}>
                    승인 대기 상품이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
