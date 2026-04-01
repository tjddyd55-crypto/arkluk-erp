"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();
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
        throw new Error(result.message ?? t("error"));
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
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateBuyerStatus(orderId: number) {
    const status = statusMap[orderId];
    if (!status) {
      setError(t("error"));
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
        throw new Error(result.message ?? t("order_failed"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("order_failed"));
    } finally {
      setPendingOrderId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">{t("loading")}</p>;
  }
  if (error) {
    return <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-gray-400">{t("no_data")}</p>;
  }

  const metricCards = [
    { label: t("kpi_my_orders"), value: data.metrics.myOrders },
    { label: t("kpi_my_shipping_orders"), value: data.metrics.shippingInProgressOrders },
    { label: t("kpi_my_delivered_orders"), value: data.metrics.deliveredOrders },
    { label: t("kpi_payment_pending_orders"), value: data.metrics.paymentPendingOrders },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("role_buyer_dashboard")}</h1>
      <p className="text-sm text-gray-400">{t("dashboard")}</p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricCards.map((card) => (
          <article key={card.label} className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
            <p className="text-xs text-gray-400">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{card.value}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/buyer/catalog"
          className="rounded-lg border border-[#2d333d] bg-[#1a1d23] p-4 text-sm text-gray-300 hover:bg-[#23272f]"
        >
          {t("products")}
        </Link>
        <Link
          href="/buyer/create-order"
          className="rounded-lg border border-[#2d333d] bg-[#1a1d23] p-4 text-sm text-gray-300 hover:bg-[#23272f]"
        >
          {t("create_order")}
        </Link>
        <Link
          href="/buyer/orders"
          className="rounded-lg border border-[#2d333d] bg-[#1a1d23] p-4 text-sm text-gray-300 hover:bg-[#23272f]"
        >
          {t("my_orders")}
        </Link>
        <Link
          href="/buyer/profile"
          className="rounded-lg border border-[#2d333d] bg-[#1a1d23] p-4 text-sm text-gray-300 hover:bg-[#23272f]"
        >
          {t("profile")}
        </Link>
      </div>

      <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <h2 className="text-lg font-semibold text-white">{t("my_orders")}</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("order_number")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("order_date")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("product_count")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("payment_status")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("shipment_status")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order) => (
                <tr key={order.id}>
                  <td className="border border-[#2d333d] px-2 py-1">
                    <Link href={`/buyer/orders/${order.id}`} className="text-blue-400 underline">
                      {order.orderNo}
                    </Link>
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {new Date(order.orderDate).toLocaleString()}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">{order.productCount}</td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    <select
                      className="rounded border border-[#2d333d] px-2 py-1 text-xs"
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
                  <td className="border border-[#2d333d] px-2 py-1">{order.shippingStatus}</td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    <button
                      type="button"
                      className="rounded border border-[#2d333d] px-2 py-1 text-xs disabled:opacity-60"
                      disabled={pendingOrderId === order.id}
                      onClick={() => updateBuyerStatus(order.id)}
                    >
                      {pendingOrderId === order.id ? t("loading") : t("update_status")}
                    </button>
                  </td>
                </tr>
              ))}
              {data.orders.length === 0 ? (
                <tr>
                  <td className="border border-[#2d333d] px-2 py-3 text-center text-gray-400" colSpan={6}>
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
