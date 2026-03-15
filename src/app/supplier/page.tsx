"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

type SupplierDashboardData = {
  metrics: {
    myOrders: number;
    preparingOrders: number;
    shippingOrders: number;
    completedOrders: number;
  };
  orders: Array<{
    orderId: number;
    orderNo: string;
    buyerName: string;
    productCount: number;
    orderStatus: string;
    shippingStatus: string;
  }>;
  shipmentTargets: Array<{
    shipmentId: number;
    shipmentNo: string;
    orderId: number;
    orderNo: string;
    shipmentStatus: "CREATED" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
    supplierStatus: "CONFIRMED" | "PREPARING" | "PACKING" | "SHIPPED" | "DELIVERED" | "HOLD";
  }>;
  recentLogs: Array<{
    id: number;
    createdAt: string;
    message: string;
    shipmentNo: string;
  }>;
};

const supplierShipmentStatuses: Array<
  "CONFIRMED" | "PREPARING" | "PACKING" | "SHIPPED" | "DELIVERED" | "HOLD"
> = ["CONFIRMED", "PREPARING", "PACKING", "SHIPPED", "DELIVERED", "HOLD"];

export default function SupplierDashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SupplierDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingShipmentId, setPendingShipmentId] = useState<number | null>(null);
  const [statusMap, setStatusMap] = useState<
    Record<number, SupplierDashboardData["shipmentTargets"][number]["supplierStatus"]>
  >({});
  const [messageMap, setMessageMap] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/supplier/dashboard");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      const payload = result.data as SupplierDashboardData;
      setData(payload);
      setStatusMap(
        payload.shipmentTargets.reduce<
          Record<number, SupplierDashboardData["shipmentTargets"][number]["supplierStatus"]>
        >((acc, shipment) => {
          acc[shipment.shipmentId] = shipment.supplierStatus;
          return acc;
        }, {}),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateShipmentStatus(shipmentId: number, orderId: number) {
    const status = statusMap[shipmentId];
    if (!status) {
      setError(t("error"));
      return;
    }
    setPendingShipmentId(shipmentId);
    setError(null);
    try {
      const response = await fetch(
        `/api/supplier/orders/${orderId}/shipments/${shipmentId}/supplier-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            statusMessage: messageMap[shipmentId] ?? null,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setMessageMap((prev) => ({ ...prev, [shipmentId]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setPendingShipmentId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">{t("loading")}</p>;
  }
  if (error) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">{t("no_data")}</p>;
  }

  const metricCards = [
    { label: t("kpi_my_orders"), value: data.metrics.myOrders },
    { label: t("kpi_preparing_orders"), value: data.metrics.preparingOrders },
    { label: t("kpi_shipping_orders"), value: data.metrics.shippingOrders },
    { label: t("kpi_completed_orders"), value: data.metrics.completedOrders },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("role_supplier_dashboard")}</h1>
      <p className="text-sm text-slate-600">{t("dashboard")}</p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricCards.map((card) => (
          <article key={card.label} className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>

      <div className="flex items-center gap-2 text-sm">
        <Link href="/supplier/orders" className="rounded border border-slate-300 px-3 py-1">
          {t("my_orders")}
        </Link>
      </div>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("my_orders")}</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">{t("order_number")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("buyer")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("product_count")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("order_status")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("shipment_status")}</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((row) => (
                <tr key={row.orderId}>
                  <td className="border border-slate-200 px-2 py-1">
                    <Link href={`/supplier/orders/${row.orderId}`} className="text-blue-700 underline">
                      {row.orderNo}
                    </Link>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{row.buyerName}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.productCount}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.orderStatus}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.shippingStatus}</td>
                </tr>
              ))}
              {data.orders.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={5}>
                    {t("no_data")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("update_status")}</h2>
        <div className="mt-2 grid gap-3">
          {data.shipmentTargets.map((shipment) => (
            <article key={shipment.shipmentId} className="rounded border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">
                [{shipment.shipmentNo}] {shipment.orderNo}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t("status")}: {shipment.supplierStatus} / {shipment.shipmentStatus}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                  value={statusMap[shipment.shipmentId] ?? shipment.supplierStatus}
                  onChange={(event) =>
                    setStatusMap((prev) => ({
                      ...prev,
                      [shipment.shipmentId]:
                        event.target.value as SupplierDashboardData["shipmentTargets"][number]["supplierStatus"],
                    }))
                  }
                >
                  {supplierShipmentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <input
                  className="min-w-60 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                  placeholder={t("message")}
                  value={messageMap[shipment.shipmentId] ?? ""}
                  onChange={(event) =>
                    setMessageMap((prev) => ({
                      ...prev,
                      [shipment.shipmentId]: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                  disabled={pendingShipmentId === shipment.shipmentId}
                  onClick={() => updateShipmentStatus(shipment.shipmentId, shipment.orderId)}
                >
                  {pendingShipmentId === shipment.shipmentId ? t("loading") : t("apply")}
                </button>
              </div>
            </article>
          ))}
          {data.shipmentTargets.length === 0 ? (
            <p className="rounded border border-slate-200 p-3 text-sm text-slate-500">
              {t("no_data")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("recent_shipment_updates")}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.recentLogs.map((log) => (
            <li key={log.id} className="rounded bg-slate-50 px-2 py-1 text-slate-700">
              {new Date(log.createdAt).toLocaleString()} [{log.shipmentNo}] {log.message}
            </li>
          ))}
          {data.recentLogs.length === 0 ? (
            <li className="rounded bg-slate-50 px-2 py-3 text-center text-slate-500">
              {t("no_data")}
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
