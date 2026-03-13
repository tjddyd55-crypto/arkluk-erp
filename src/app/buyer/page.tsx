"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BuyerDashboardData = {
  metrics: {
    myOrders: number;
    shippingInProgressOrders: number;
    deliveredOrders: number;
    paymentPendingOrders: number;
  };
  orders: Array<{
    id: number;
    orderNo: string;
    orderDate: string;
    productCount: number;
    paymentStatus: "ORDER_CREATED" | "PAYMENT_PENDING" | "PAYMENT_COMPLETED" | "ORDER_CANCELLED";
    shippingStatus: "PENDING" | "IN_PROGRESS" | "DELIVERED";
  }>;
};

const buyerStatusLabelMap: Record<
  "ORDER_CREATED" | "PAYMENT_PENDING" | "PAYMENT_COMPLETED" | "ORDER_CANCELLED",
  string
> = {
  ORDER_CREATED: "ORDER_CREATED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
};

export default function BuyerDashboardPage() {
  const [data, setData] = useState<BuyerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [statusMap, setStatusMap] = useState<
    Record<number, BuyerDashboardData["orders"][number]["paymentStatus"]>
  >({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/buyer/dashboard");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "BUYER 대시보드 조회 실패");
      }
      const payload = result.data as BuyerDashboardData;
      setData(payload);
      setStatusMap(
        payload.orders.reduce<Record<number, BuyerDashboardData["orders"][number]["paymentStatus"]>>(
          (acc, order) => {
            acc[order.id] = order.paymentStatus;
            return acc;
          },
          {},
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "BUYER 대시보드 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateBuyerStatus(orderId: number) {
    const status = statusMap[orderId];
    if (!status) {
      setError("변경할 상태를 선택해 주세요.");
      return;
    }
    setPendingOrderId(orderId);
    setError(null);
    try {
      const response = await fetch(`/api/buyer/orders/${orderId}/buyer-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "주문 상태 변경 실패");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 상태 변경 실패");
    } finally {
      setPendingOrderId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">BUYER 대시보드를 불러오는 중...</p>;
  }
  if (error) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">조회할 데이터가 없습니다.</p>;
  }

  const metricCards = [
    { label: "내 주문 수", value: data.metrics.myOrders },
    { label: "배송 진행 주문", value: data.metrics.shippingInProgressOrders },
    { label: "배송 완료 주문", value: data.metrics.deliveredOrders },
    { label: "결제 대기", value: data.metrics.paymentPendingOrders },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">BUYER Dashboard</h1>
      <p className="text-sm text-slate-600">
        내 주문/배송 상태를 확인하고 BUYER 주문 상태를 직접 변경합니다.
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricCards.map((card) => (
          <article key={card.label} className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/buyer/catalog"
          className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:bg-slate-50"
        >
          상품 카탈로그 조회
        </Link>
        <Link
          href="/buyer/create-order"
          className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:bg-slate-50"
        >
          주문 생성
        </Link>
        <Link
          href="/buyer/orders"
          className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:bg-slate-50"
        >
          내 주문 내역
        </Link>
        <Link
          href="/buyer/profile"
          className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:bg-slate-50"
        >
          내 프로필
        </Link>
      </div>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">내 주문 상태 관리</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">주문일</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상품 수</th>
                <th className="border border-slate-200 px-2 py-1 text-left">결제 상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">배송 상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">변경</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order) => (
                <tr key={order.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    <Link href={`/buyer/orders/${order.id}`} className="text-blue-700 underline">
                      {order.orderNo}
                    </Link>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(order.orderDate).toLocaleString()}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{order.productCount}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                      value={statusMap[order.id] ?? order.paymentStatus}
                      onChange={(event) =>
                        setStatusMap((prev) => ({
                          ...prev,
                          [order.id]:
                            event.target.value as BuyerDashboardData["orders"][number]["paymentStatus"],
                        }))
                      }
                    >
                      {Object.entries(buyerStatusLabelMap).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{order.shippingStatus}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                      disabled={pendingOrderId === order.id}
                      onClick={() => updateBuyerStatus(order.id)}
                    >
                      {pendingOrderId === order.id ? "처리 중..." : "상태 변경"}
                    </button>
                  </td>
                </tr>
              ))}
              {data.orders.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={6}>
                    주문 데이터가 없습니다.
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
