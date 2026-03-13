"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SuperAdminDashboardData = {
  metrics: {
    totalOrders: number;
    ordersToday: number;
    shippingInProgress: number;
    deliveredOrders: number;
  };
  orderStatusStats: {
    CREATED: number;
    UNDER_REVIEW: number;
    ASSIGNED: number;
    SUPPLIER_CONFIRMED: number;
    SHIPPED: number;
    DELIVERED: number;
  };
  recentOrders: Array<{
    id: number;
    order_no: string;
    status: string;
    created_at: string;
    country: {
      country_name: string;
      country_code: string;
    };
    buyer: {
      name: string;
    };
  }>;
  recentShipmentStatusLogs: Array<{
    id: number;
    createdAt: string;
    supplierName: string;
    message: string;
  }>;
};

export function SuperAdminDashboard() {
  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/dashboard");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "SUPER_ADMIN 대시보드 조회 실패");
        }
        setData(result.data as SuperAdminDashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "SUPER_ADMIN 대시보드 조회 실패");
      }
    }
    load();
  }, []);

  if (error) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">SUPER_ADMIN 대시보드 로딩 중...</p>;
  }

  const cards = [
    { label: "Total Orders", value: data.metrics.totalOrders },
    { label: "Orders Today", value: data.metrics.ordersToday },
    { label: "Shipping In Progress", value: data.metrics.shippingInProgress },
    { label: "Delivered Orders", value: data.metrics.deliveredOrders },
  ];

  const orderStatusRows = [
    { label: "CREATED", value: data.orderStatusStats.CREATED },
    { label: "UNDER_REVIEW", value: data.orderStatusStats.UNDER_REVIEW },
    { label: "ASSIGNED", value: data.orderStatusStats.ASSIGNED },
    { label: "SUPPLIER_CONFIRMED", value: data.orderStatusStats.SUPPLIER_CONFIRMED },
    { label: "SHIPPED", value: data.orderStatusStats.SHIPPED },
    { label: "DELIVERED", value: data.orderStatusStats.DELIVERED },
  ];

  const maxStatusValue = Math.max(...orderStatusRows.map((row) => row.value), 1);

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
        <h2 className="text-lg font-semibold text-slate-900">Order Status</h2>
        <div className="mt-3 space-y-2">
          {orderStatusRows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-700">{row.label}</span>
                <span className="font-semibold text-slate-900">{row.value}</span>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-slate-700"
                  style={{ width: `${Math.max((row.value / maxStatusValue) * 100, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">최근 주문 리스트</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">국가</th>
                <th className="border border-slate-200 px-2 py-1 text-left">바이어</th>
                <th className="border border-slate-200 px-2 py-1 text-left">주문 상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">생성일</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    <Link href={`/admin/orders/${order.id}`} className="text-blue-700 underline">
                      {order.order_no}
                    </Link>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {order.country.country_name} ({order.country.country_code})
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{order.buyer.name}</td>
                  <td className="border border-slate-200 px-2 py-1">{order.status}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(order.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.recentOrders.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={5}>
                    최근 주문이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">최근 배송 상태 업데이트</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">시간</th>
                <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                <th className="border border-slate-200 px-2 py-1 text-left">메시지</th>
              </tr>
            </thead>
            <tbody>
              {data.recentShipmentStatusLogs.map((log) => (
                <tr key={log.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{log.supplierName}</td>
                  <td className="border border-slate-200 px-2 py-1">{log.message}</td>
                </tr>
              ))}
              {data.recentShipmentStatusLogs.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={3}>
                    최근 배송 상태 로그가 없습니다.
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
