"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/supply-dashboard");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? t("error"));
        }
        setData(result.data as KoreaSupplyDashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("error"));
      }
    }
    load();
  }, [t]);

  if (error) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">{t("loading")}</p>;
  }

  const cards = [
    { label: t("kpi_total_supplier_orders"), value: data.metrics.totalSupplierOrders },
    { label: t("kpi_shipping_in_progress"), value: data.metrics.shippingInProgressOrders },
    { label: t("kpi_waiting_shipments"), value: data.metrics.waitingShipmentOrders },
    { label: t("kpi_delayed_orders"), value: data.metrics.delayedOrders },
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
        <h2 className="text-lg font-semibold text-slate-900">{t("suppliers")} {t("orders")}</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">{t("supplier")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("orders")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("in_progress")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("completed")}</th>
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
                    {t("no_data")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("recent_activity")}</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">{t("time")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("supplier")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("message")}</th>
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
