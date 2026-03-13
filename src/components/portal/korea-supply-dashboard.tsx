"use client";

import { useEffect, useState } from "react";

type KoreaSupplyDashboardData = {
  metrics: {
    totalSupplierOrders: number;
    shippingInProgressOrders: number;
    waitingShipmentOrders: number;
    delayedOrders: number;
  };
  supplierOrderStats: Array<{
    supplierId: number;
    supplierName: string;
    orderCount: number;
    shippingInProgress: number;
    completed: number;
  }>;
  recentSupplierActivities: Array<{
    id: number;
    createdAt: string;
    supplierName: string;
    message: string;
  }>;
};

export function KoreaSupplyDashboard() {
  const [data, setData] = useState<KoreaSupplyDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/supply-dashboard");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "KOREA_SUPPLY_ADMIN 대시보드 조회 실패");
        }
        setData(result.data as KoreaSupplyDashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "KOREA_SUPPLY_ADMIN 대시보드 조회 실패");
      }
    }
    load();
  }, []);

  if (error) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">KOREA_SUPPLY_ADMIN 대시보드 로딩 중...</p>;
  }

  const cards = [
    { label: "총 공급사 주문", value: data.metrics.totalSupplierOrders },
    { label: "배송 진행 주문", value: data.metrics.shippingInProgressOrders },
    { label: "출고 대기 주문", value: data.metrics.waitingShipmentOrders },
    { label: "지연 주문", value: data.metrics.delayedOrders },
  ];

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">공급사별 주문 현황</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                <th className="border border-slate-200 px-2 py-1 text-left">주문 수</th>
                <th className="border border-slate-200 px-2 py-1 text-left">배송 중</th>
                <th className="border border-slate-200 px-2 py-1 text-left">완료</th>
              </tr>
            </thead>
            <tbody>
              {data.supplierOrderStats.map((row) => (
                <tr key={row.supplierId}>
                  <td className="border border-slate-200 px-2 py-1">{row.supplierName}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.orderCount}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.shippingInProgress}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.completed}</td>
                </tr>
              ))}
              {data.supplierOrderStats.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={4}>
                    공급사 주문 데이터가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">최근 공급사 활동</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">시간</th>
                <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태 메시지</th>
              </tr>
            </thead>
            <tbody>
              {data.recentSupplierActivities.map((log) => (
                <tr key={log.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{log.supplierName}</td>
                  <td className="border border-slate-200 px-2 py-1">{log.message}</td>
                </tr>
              ))}
              {data.recentSupplierActivities.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={3}>
                    최근 공급사 활동이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
