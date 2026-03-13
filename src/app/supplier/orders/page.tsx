"use client";

import { useEffect, useState } from "react";

type SupplierOrderRow = {
  order_id: number;
  status:
    | "WAITING"
    | "SENT"
    | "SUPPLIER_CONFIRMED"
    | "DELIVERING"
    | "COMPLETED"
    | "CANCELLED";
  sent_at: string | null;
  supplier_confirmed_at: string | null;
  expected_delivery_date: string | null;
  order: {
    order_no: string;
    status: string;
    created_at: string;
    buyer: { name: string };
    country: { country_name: string };
  };
};

const statusLabelMap: Record<
  "WAITING" | "SENT" | "SUPPLIER_CONFIRMED" | "DELIVERING" | "COMPLETED" | "CANCELLED",
  string
> = {
  WAITING: "발송 대기",
  SENT: "발송 완료",
  SUPPLIER_CONFIRMED: "공급사 확인",
  DELIVERING: "출고 완료",
  COMPLETED: "납품 완료",
  CANCELLED: "취소",
};

export default function SupplierOrdersPage() {
  const [rows, setRows] = useState<SupplierOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function getStatusLabel(row: SupplierOrderRow) {
    if (row.status === "WAITING" && row.order.status === "ASSIGNED") {
      return "배정 완료";
    }
    return statusLabelMap[row.status];
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/supplier/orders");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "주문 목록 조회 실패");
        }
        setRows(result.data as SupplierOrderRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "주문 목록 조회 실패");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>

      {loading ? <p className="text-sm text-slate-500">주문 목록을 불러오는 중...</p> : null}
      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {!loading && !error ? (
        <div className="overflow-auto rounded border border-slate-200 bg-white p-4">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">바이어</th>
                <th className="border border-slate-200 px-2 py-1 text-left">국가</th>
                <th className="border border-slate-200 px-2 py-1 text-left">발송일</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">납기예정</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.order_id}>
                  <td className="border border-slate-200 px-2 py-1">
                    <a className="text-blue-700 underline" href={`/supplier/orders/${row.order_id}`}>
                      {row.order.order_no}
                    </a>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{row.order.buyer.name}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.order.country.country_name}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {row.sent_at ? new Date(row.sent_at).toLocaleString() : "-"}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{getStatusLabel(row)}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {row.expected_delivery_date
                      ? new Date(row.expected_delivery_date).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={6}>
                    조회된 주문이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
