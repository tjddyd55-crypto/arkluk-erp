"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DashboardData = {
  dashboardType: "SUPER_ADMIN" | "KOREA_SUPPLY_ADMIN";
  metrics: {
    todayCreatedOrders: number;
    deliveryInProgressOrders: number;
    assignmentPendingOrders: number;
    supplierUnconfirmedOrders: number;
    deliveryCompletedOrders: number;
    delayedOrders: number;
    delayedShipments: number;
  };
  orderStatusStats: {
    CREATED: number;
    UNDER_REVIEW: number;
    ASSIGNED: number;
    SUPPLIER_CONFIRMED: number;
    SHIPPED: number;
    DELIVERED: number;
  };
  shipmentStatusStats: {
    CREATED: number;
    SHIPPED: number;
    IN_TRANSIT: number;
    DELIVERED: number;
  };
  recentOrders: Array<{
    id: number;
    order_no: string;
    status: string;
    created_at: string;
    country: {
      id: number;
      country_code: string;
      country_name: string;
    };
    buyer: {
      id: number;
      name: string;
    };
  }>;
  recentShipmentStatusLogs: Array<{
    id: number;
    createdAt: string;
    message: string;
    shipmentNo: string;
    supplierName: string;
  }>;
  delayedOrders: Array<{
    id: number;
    orderNo: string;
    countryCode: string;
    countryName: string;
    buyerName: string;
    assignedAt: string;
    delayedSuppliers: string[];
  }>;
  delayedShipments: Array<{
    id: number;
    shipmentNo: string;
    orderId: number;
    orderNo: string;
    supplierName: string;
    shippedAt: string;
  }>;
  superAdmin: {
    countryOrderStats: Array<{
      countryId: number;
      countryName: string;
      countryCode: string;
      orderCount: number;
    }>;
    supplierOrderStats: Array<{
      supplierId: number;
      supplierName: string;
      orderCount: number;
    }>;
    shipmentProgress: {
      CREATED: number;
      SHIPPED: number;
      IN_TRANSIT: number;
      DELIVERED: number;
    };
  };
  koreaSupplyAdmin: {
    supplierOrderStatusStats: Array<{
      supplierId: number;
      supplierName: string;
      statusCounts: Record<string, number>;
    }>;
    shipmentProgress: {
      CREATED: number;
      SHIPPED: number;
      IN_TRANSIT: number;
      DELIVERED: number;
    };
    delayedOrders: Array<{
      id: number;
      orderNo: string;
      countryCode: string;
      countryName: string;
      buyerName: string;
      assignedAt: string;
      delayedSuppliers: string[];
    }>;
  };
};

export function OperationsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/dashboard");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "대시보드 조회 실패");
        }
        setData(result.data as DashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "대시보드 조회 실패");
      }
    }

    load();
  }, []);

  if (error) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">Operations Dashboard 로딩 중...</p>;
  }

  const metricCards = [
    { label: "오늘 생성 주문", value: data.metrics.todayCreatedOrders },
    { label: "배송 진행 주문", value: data.metrics.deliveryInProgressOrders },
    { label: "배정 대기 주문", value: data.metrics.assignmentPendingOrders },
    { label: "공급사 미확인 주문", value: data.metrics.supplierUnconfirmedOrders },
    { label: "배송 완료 주문", value: data.metrics.deliveryCompletedOrders },
    { label: "Delayed Orders", value: data.metrics.delayedOrders },
    { label: "Delayed Shipments", value: data.metrics.delayedShipments },
  ];
  const isSuperAdmin = data.dashboardType === "SUPER_ADMIN";
  const isKoreaSupplyAdmin = data.dashboardType === "KOREA_SUPPLY_ADMIN";

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {metricCards.map((card) => (
          <article key={card.label} className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">주문 상태 통계</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <p>CREATED: {data.orderStatusStats.CREATED}</p>
            <p>UNDER_REVIEW: {data.orderStatusStats.UNDER_REVIEW}</p>
            <p>ASSIGNED: {data.orderStatusStats.ASSIGNED}</p>
            <p>SUPPLIER_CONFIRMED: {data.orderStatusStats.SUPPLIER_CONFIRMED}</p>
            <p>SHIPPED: {data.orderStatusStats.SHIPPED}</p>
            <p>DELIVERED: {data.orderStatusStats.DELIVERED}</p>
          </div>
        </article>

        <article className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">배송 진행 상황 (Shipment)</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <p>CREATED: {data.shipmentStatusStats.CREATED}</p>
            <p>SHIPPED: {data.shipmentStatusStats.SHIPPED}</p>
            <p>IN_TRANSIT: {data.shipmentStatusStats.IN_TRANSIT}</p>
            <p>DELIVERED: {data.shipmentStatusStats.DELIVERED}</p>
          </div>
        </article>
      </section>

      {isSuperAdmin ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">국가별 주문 현황</h2>
            <div className="mt-2 overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-2 py-1 text-left">국가</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">주문 수</th>
                  </tr>
                </thead>
                <tbody>
                  {data.superAdmin.countryOrderStats.map((row) => (
                    <tr key={row.countryId}>
                      <td className="border border-slate-200 px-2 py-1">
                        {row.countryName} ({row.countryCode})
                      </td>
                      <td className="border border-slate-200 px-2 py-1">{row.orderCount}</td>
                    </tr>
                  ))}
                  {data.superAdmin.countryOrderStats.length === 0 ? (
                    <tr>
                      <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={2}>
                        데이터가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
          <article className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">공급사별 주문 현황</h2>
            <div className="mt-2 overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">주문 수</th>
                  </tr>
                </thead>
                <tbody>
                  {data.superAdmin.supplierOrderStats.map((row) => (
                    <tr key={row.supplierId}>
                      <td className="border border-slate-200 px-2 py-1">{row.supplierName}</td>
                      <td className="border border-slate-200 px-2 py-1">{row.orderCount}</td>
                    </tr>
                  ))}
                  {data.superAdmin.supplierOrderStats.length === 0 ? (
                    <tr>
                      <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={2}>
                        데이터가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {isKoreaSupplyAdmin ? (
        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">공급사 주문 현황 (상태별)</h2>
          <div className="mt-2 overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">상태별 수량</th>
                </tr>
              </thead>
              <tbody>
                {data.koreaSupplyAdmin.supplierOrderStatusStats.map((row) => (
                  <tr key={row.supplierId}>
                    <td className="border border-slate-200 px-2 py-1">{row.supplierName}</td>
                    <td className="border border-slate-200 px-2 py-1">
                      {Object.entries(row.statusCounts)
                        .map(([status, count]) => `${status}: ${count}`)
                        .join(" / ")}
                    </td>
                  </tr>
                ))}
                {data.koreaSupplyAdmin.supplierOrderStatusStats.length === 0 ? (
                  <tr>
                    <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={2}>
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Delayed Orders</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">국가</th>
                <th className="border border-slate-200 px-2 py-1 text-left">바이어</th>
                <th className="border border-slate-200 px-2 py-1 text-left">지연 공급사</th>
                <th className="border border-slate-200 px-2 py-1 text-left">배정 시각</th>
              </tr>
            </thead>
            <tbody>
              {data.delayedOrders.map((row) => (
                <tr key={row.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    <Link href={`/admin/orders/${row.id}`} className="text-blue-700 underline">
                      {row.orderNo}
                    </Link>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {row.countryName} ({row.countryCode})
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{row.buyerName}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {row.delayedSuppliers.join(", ") || "-"}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(row.assignedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.delayedOrders.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={5}>
                    지연 주문이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Delayed Shipments</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">Shipment</th>
                <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                <th className="border border-slate-200 px-2 py-1 text-left">출고 시각</th>
              </tr>
            </thead>
            <tbody>
              {data.delayedShipments.map((row) => (
                <tr key={row.id}>
                  <td className="border border-slate-200 px-2 py-1">{row.shipmentNo}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    <Link href={`/admin/orders/${row.orderId}`} className="text-blue-700 underline">
                      {row.orderNo}
                    </Link>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{row.supplierName}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(row.shippedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.delayedShipments.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={4}>
                    지연 배송이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">최근 주문 10개</h2>
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
                    주문 데이터가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">최근 배송 상태</h2>
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
                  <td className="border border-slate-200 px-2 py-1">
                    [{log.shipmentNo}] {log.message}
                  </td>
                </tr>
              ))}
              {data.recentShipmentStatusLogs.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={3}>
                    배송 상태 로그가 없습니다.
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
