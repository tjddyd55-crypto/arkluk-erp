"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BuyerOrderRow = {
  id: number;
  order_no: string;
  status: string;
  created_at: string;
  buyer: { name: string };
  country: { country_name: string };
};

export default function BuyerOrdersPage() {
  const [rows, setRows] = useState<BuyerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/buyer/orders");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "주문 목록 조회 실패");
        }
        setRows(result.data as BuyerOrderRow[]);
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
      <h1 className="text-2xl font-bold text-slate-900">내 주문 목록</h1>
      {loading ? <p className="text-sm text-slate-500">주문 목록을 불러오는 중...</p> : null}
      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!loading && !error ? (
        <section className="rounded border border-slate-200 bg-white p-4">
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">바이어</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">국가</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">생성일</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-slate-200 px-2 py-1">
                      <Link className="text-blue-700 underline" href={`/buyer/orders/${row.id}`}>
                        {row.order_no}
                      </Link>
                    </td>
                    <td className="border border-slate-200 px-2 py-1">{row.status}</td>
                    <td className="border border-slate-200 px-2 py-1">{row.buyer.name}</td>
                    <td className="border border-slate-200 px-2 py-1">{row.country.country_name}</td>
                    <td className="border border-slate-200 px-2 py-1">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={5}>
                      조회된 주문이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
