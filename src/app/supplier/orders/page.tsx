"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

type SupplierOrderRow = {
  order_id: number;
  status:
    | "PENDING"
    | "SENT"
    | "CONFIRMED"
    | "SHIPPING"
    | "COMPLETED"
    | "CANCELLED"
    | "REJECTED";
  sent_at: string | null;
  supplier_confirmed_at: string | null;
  expected_delivery_date: string | null;
  order: {
    order_no: string;
    status: string;
    created_at: string;
    buyer: { name: string };
    country: { country_name: string };
  };
};

const statusLabelMap: Record<
  | "PENDING"
  | "SENT"
  | "CONFIRMED"
  | "SHIPPING"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED",
  string
> = {
  PENDING: "PENDING",
  SENT: "SENT",
  CONFIRMED: "CONFIRMED",
  SHIPPING: "SHIPPING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED",
};

export default function SupplierOrdersPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SupplierOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function getStatusLabel(row: SupplierOrderRow) {
    if (row.status === "PENDING" && row.order.status === "ASSIGNED") {
      return "ASSIGNED";
    }
    return statusLabelMap[row.status];
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/supplier/orders");
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? t("error"));
        }
        setRows(result.data as SupplierOrderRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("error"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [t]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("my_orders")}</h1>

      {loading ? <p className="text-sm text-slate-500">{t("loading")}</p> : null}
      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {!loading && !error ? (
        <div className="overflow-auto rounded border border-slate-200 bg-white p-4">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">{t("order_number")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("buyer")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("country")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("created_at")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("status")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">ETA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.order_id}>
                  <td className="border border-slate-200 px-2 py-1">
                    <a className="text-blue-700 underline" href={`/supplier/orders/${row.order_id}`}>
                      {row.order.order_no}
                    </a>
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{row.order.buyer.name}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.order.country.country_name}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {row.sent_at ? new Date(row.sent_at).toLocaleString() : "-"}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{getStatusLabel(row)}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {row.expected_delivery_date
                      ? new Date(row.expected_delivery_date).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={6}>
                    {t("no_data")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
