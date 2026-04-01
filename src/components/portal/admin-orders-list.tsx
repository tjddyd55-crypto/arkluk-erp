"use client";

import { useEffect, useState } from "react";

type OrderRow = {
  id: number;
  order_no: string;
  status: string;
  created_at: string;
  buyer: { name: string };
  country: { country_name: string };
  suppliers: Array<{ status: string; supplier: { supplier_name: string } }>;
};

export function AdminOrdersList() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/orders");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "주문 목록 조회 실패");
        }
        setRows(result.data as OrderRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "주문 목록 조회 실패");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-400">주문 목록을 불러오는 중...</p>;
  }

  if (error) {
    return <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="overflow-auto rounded border border-[#2d333d] bg-[#1a1d23] p-4">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#111318]">
            <th className="border border-[#2d333d] px-2 py-1 text-left">주문번호</th>
            <th className="border border-[#2d333d] px-2 py-1 text-left">바이어</th>
            <th className="border border-[#2d333d] px-2 py-1 text-left">국가</th>
            <th className="border border-[#2d333d] px-2 py-1 text-left">상태</th>
            <th className="border border-[#2d333d] px-2 py-1 text-left">공급사 상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border border-[#2d333d] px-2 py-1">
                <a className="text-blue-400 underline" href={`/admin/orders/${row.id}`}>
                  {row.order_no}
                </a>
              </td>
              <td className="border border-[#2d333d] px-2 py-1">{row.buyer.name}</td>
              <td className="border border-[#2d333d] px-2 py-1">{row.country.country_name}</td>
              <td className="border border-[#2d333d] px-2 py-1">{row.status}</td>
              <td className="border border-[#2d333d] px-2 py-1">
                {row.suppliers
                  .map((supplier) => `${supplier.supplier.supplier_name}:${supplier.status}`)
                  .join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
