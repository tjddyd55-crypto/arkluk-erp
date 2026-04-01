"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/dashboard");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? t("error"));
        }
        setData(result.data as SuperAdminDashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("error"));
      }
    }
    load();
  }, [t]);

  if (error) {
    return <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-gray-400">{t("loading")}</p>;
  }

  const cards = [
    { label: t("kpi_total_orders"), value: data.metrics.totalOrders },
    { label: t("kpi_orders_today"), value: data.metrics.ordersToday },
    { label: t("kpi_shipping_in_progress"), value: data.metrics.shippingInProgress },
    { label: t("kpi_delivered_orders"), value: data.metrics.deliveredOrders },
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
          <article key={card.label} className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
            <p className="text-xs text-gray-400">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <h2 className="text-lg font-semibold text-white">{t("order_status")}</h2>
        <div className="mt-3 space-y-2">
          {orderStatusRows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-300">{row.label}</span>
                <span className="font-semibold text-white">{row.value}</span>
              </div>
              <div className="h-2 rounded bg-[#111318]">
                <div
                  className="h-2 rounded bg-[#23272f]"
                  style={{ width: `${Math.max((row.value / maxStatusValue) * 100, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <h2 className="text-lg font-semibold text-white">{t("recent_orders")}</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("order_number")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("country")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("buyer")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("order_status")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("created_at")}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="border border-[#2d333d] px-2 py-1">
                    <Link href={`/admin/orders/${order.id}`} className="text-blue-400 underline">
                      {order.order_no}
                    </Link>
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {order.country.country_name} ({order.country.country_code})
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">{order.buyer.name}</td>
                  <td className="border border-[#2d333d] px-2 py-1">{order.status}</td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {new Date(order.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.recentOrders.length === 0 ? (
                <tr>
                  <td className="border border-[#2d333d] px-2 py-3 text-center text-gray-400" colSpan={5}>
                    {t("no_data")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <h2 className="text-lg font-semibold text-white">{t("recent_shipment_updates")}</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("time")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("supplier")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("message")}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentShipmentStatusLogs.map((log) => (
                <tr key={log.id}>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">{log.supplierName}</td>
                  <td className="border border-[#2d333d] px-2 py-1">{log.message}</td>
                </tr>
              ))}
              {data.recentShipmentStatusLogs.length === 0 ? (
                <tr>
                  <td className="border border-[#2d333d] px-2 py-3 text-center text-gray-400" colSpan={3}>
                    {t("no_data")}
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
