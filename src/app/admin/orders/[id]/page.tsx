"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

type OrderDetail = {
  id: number;
  order_no: string;
  status: string;
  buyer: { name: string };
  country: { country_name: string };
  suppliers: Array<{
    supplier_id: number;
    status:
      | "WAITING"
      | "SENT"
      | "SUPPLIER_CONFIRMED"
      | "DELIVERING"
      | "COMPLETED"
      | "CANCELLED";
    sent_at: string | null;
    supplier_confirmed_at: string | null;
    expected_delivery_date: string | null;
    supplier_note: string | null;
    supplier: { id: number; supplier_name: string };
  }>;
  order_items: Array<{
    id: number;
    supplier_id: number;
    product_code_snapshot: string;
    product_name_snapshot: string;
    spec_snapshot: string;
    qty: string;
    unit_snapshot: string;
    memo: string | null;
  }>;
  purchase_orders: Array<{
    id: number;
    supplier_id: number;
    file_name: string;
    created_at: string;
  }>;
  tax_invoices: Array<{
    id: number;
    order_link_type: "AUTO" | "MANUAL" | null;
    supplier: { supplier_name: string } | null;
    email_inbox: { from_email: string; received_at: string };
    files: Array<{ id: number; file_type: "PDF" | "XML"; file_name: string }>;
  }>;
};

type SupplierOption = {
  id: number;
  supplier_name: string;
  is_active: boolean;
};

export default function AdminOrderDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendingSupplierId, setSendingSupplierId] = useState<number | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [cancellingSupplierId, setCancellingSupplierId] = useState<number | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [selectedSupplierMap, setSelectedSupplierMap] = useState<Record<number, number>>({});
  const [assigningItemId, setAssigningItemId] = useState<number | null>(null);
  const [assigningOrderMode, setAssigningOrderMode] = useState<"AUTO" | "TIMEOUT" | null>(null);

  async function loadOrderDetail() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      const detail = result.data as OrderDetail;
      setOrder(detail);
      setSelectedSupplierMap(
        detail.order_items.reduce<Record<number, number>>((acc, item) => {
          acc[item.id] = item.supplier_id;
          return acc;
        }, {}),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }

  async function loadSupplierOptions() {
    try {
      const response = await fetch("/api/admin/suppliers");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setSupplierOptions(
        (result.data as SupplierOption[]).filter((supplier) => supplier.is_active),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("error"));
    }
  }

  useEffect(() => {
    if (!Number.isNaN(orderId)) {
      loadOrderDetail();
      loadSupplierOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function sendPurchaseOrderToSupplier(supplierId: number) {
    setActionMessage(null);
    setActionError(null);
    setSendingSupplierId(supplierId);
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/send-supplier?supplierId=${supplierId}`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setActionMessage(t("success"));
      await loadOrderDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("error"));
    } finally {
      setSendingSupplierId(null);
    }
  }

  async function sendPurchaseOrderToAll() {
    setActionMessage(null);
    setActionError(null);
    setSendingAll(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/send-all`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setActionMessage(t("success"));
      await loadOrderDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("error"));
    } finally {
      setSendingAll(false);
    }
  }

  async function cancelSupplierOrder(supplierId: number) {
    setActionMessage(null);
    setActionError(null);
    setCancellingSupplierId(supplierId);
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/cancel-supplier?supplierId=${supplierId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "관리자 발주 취소" }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setActionMessage(t("success"));
      await loadOrderDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("error"));
    } finally {
      setCancellingSupplierId(null);
    }
  }

  async function assignOrderItem(orderItemId: number) {
    const supplierId = selectedSupplierMap[orderItemId];
    if (!supplierId) {
      setActionError(t("error"));
      return;
    }
    setActionMessage(null);
    setActionError(null);
    setAssigningItemId(orderItemId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/assignment/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId, supplierId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setActionMessage(t("success"));
      await loadOrderDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("error"));
    } finally {
      setAssigningItemId(null);
    }
  }

  async function runAutoAssignment(mode: "AUTO" | "TIMEOUT") {
    setActionMessage(null);
    setActionError(null);
    setAssigningOrderMode(mode);
    try {
      const endpoint =
        mode === "AUTO"
          ? `/api/admin/orders/${orderId}/assignment/auto`
          : `/api/admin/orders/${orderId}/assignment/timeout`;
      const response = await fetch(endpoint, { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setActionMessage(
        mode === "AUTO"
          ? t("success")
          : t("success"),
      );
      await loadOrderDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("error"));
    } finally {
      setAssigningOrderMode(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">{t("loading")}</p>;
  }

  if (error || !order) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error ?? t("not_found")}</p>;
  }

  const groupedInvoices = order.tax_invoices.reduce<
    Record<
      string,
      Array<{
        id: number;
        order_link_type: "AUTO" | "MANUAL" | null;
        email_inbox: { from_email: string; received_at: string };
        files: Array<{ id: number; file_type: "PDF" | "XML"; file_name: string }>;
      }>
    >
  >((acc, invoice) => {
    const key = invoice.supplier?.supplier_name ?? "Unclassified";
    acc[key] = acc[key] ?? [];
    acc[key].push(invoice);
    return acc;
  }, {});

  const groupedItemsBySupplier = order.order_items.reduce<
    Record<
      number,
      Array<{
        id: number;
        product_code_snapshot: string;
        product_name_snapshot: string;
        spec_snapshot: string;
        unit_snapshot: string;
        qty: string;
        memo: string | null;
      }>
    >
  >((acc, item) => {
    acc[item.supplier_id] = acc[item.supplier_id] ?? [];
    acc[item.supplier_id].push(item);
    return acc;
  }, {});

  const purchaseOrderBySupplier = order.purchase_orders.reduce<
    Record<
      number,
      {
        id: number;
        file_name: string;
        created_at: string;
      }
    >
  >((acc, po) => {
    acc[po.supplier_id] = {
      id: po.id,
      file_name: po.file_name,
      created_at: po.created_at,
    };
    return acc;
  }, {});

  const statusChangeDisabled = true;

  const statusLabelMap: Record<
    "WAITING" | "SENT" | "SUPPLIER_CONFIRMED" | "DELIVERING" | "COMPLETED" | "CANCELLED",
    string
  > = {
    WAITING: "WAITING",
    SENT: "SENT",
    SUPPLIER_CONFIRMED: "SUPPLIER_CONFIRMED",
    DELIVERING: "DELIVERING",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
  };

  return (
    <div className="space-y-4">
      <header className="rounded border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">{order.order_no}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("buyer")}: {order.buyer.name} / {t("country")}: {order.country.country_name} / {t("status")}: {order.status}
        </p>
      </header>

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("suppliers")} {t("orders")} ({t("view_only_policy")})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
              disabled={statusChangeDisabled || assigningOrderMode !== null}
              onClick={() => runAutoAssignment("AUTO")}
            >
              {assigningOrderMode === "AUTO" ? t("loading") : t("confirm")}
            </button>
            <button
              type="button"
              className="rounded border border-indigo-300 px-3 py-2 text-sm text-indigo-700 disabled:opacity-60"
              disabled={statusChangeDisabled || assigningOrderMode !== null}
              onClick={() => runAutoAssignment("TIMEOUT")}
            >
              {assigningOrderMode === "TIMEOUT" ? t("loading") : t("confirm")}
            </button>
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={statusChangeDisabled || sendingAll}
              onClick={sendPurchaseOrderToAll}
            >
              {sendingAll ? t("loading") : t("orders")}
            </button>
          </div>
        </div>
        {actionMessage ? (
          <p className="mt-2 rounded bg-emerald-50 p-2 text-xs text-emerald-700">{actionMessage}</p>
        ) : null}
        {actionError ? (
          <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{actionError}</p>
        ) : null}
        <p className="mt-2 text-xs text-amber-700">
          {t("view_only_policy")}
        </p>

        <div className="mt-3 space-y-4">
          {order.suppliers.map((supplierRow) => {
            const items = groupedItemsBySupplier[supplierRow.supplier_id] ?? [];
            const purchaseOrder = purchaseOrderBySupplier[supplierRow.supplier_id];

            return (
              <article
                key={supplierRow.supplier_id}
                className="rounded border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {supplierRow.supplier.supplier_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t("status")}: {statusLabelMap[supplierRow.status]}
                      {supplierRow.sent_at
                        ? ` / ${t("created_at")}: ${new Date(supplierRow.sent_at).toLocaleString()}`
                        : ""}
                      {supplierRow.supplier_confirmed_at
                        ? ` / ${t("confirm")}: ${new Date(supplierRow.supplier_confirmed_at).toLocaleString()}`
                        : ""}
                      {supplierRow.expected_delivery_date
                        ? ` / ETA: ${new Date(supplierRow.expected_delivery_date).toLocaleDateString()}`
                        : ""}
                    </p>
                    {supplierRow.supplier_note ? (
                      <p className="mt-1 text-xs text-slate-600">{t("message")}: {supplierRow.supplier_note}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
                      disabled={
                        statusChangeDisabled ||
                        supplierRow.status !== "WAITING" ||
                        sendingSupplierId === supplierRow.supplier_id
                      }
                      onClick={() => sendPurchaseOrderToSupplier(supplierRow.supplier_id)}
                    >
                      {sendingSupplierId === supplierRow.supplier_id
                        ? t("loading")
                        : `${supplierRow.supplier.supplier_name} ${t("orders")}`}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-60"
                      disabled={
                        statusChangeDisabled ||
                        (supplierRow.status !== "SENT" &&
                          supplierRow.status !== "SUPPLIER_CONFIRMED") ||
                        cancellingSupplierId === supplierRow.supplier_id
                      }
                      onClick={() => cancelSupplierOrder(supplierRow.supplier_id)}
                    >
                      {cancellingSupplierId === supplierRow.supplier_id ? t("loading") : t("cancel")}
                    </button>
                    {purchaseOrder ? (
                      <a
                        href={`/api/admin/purchase-orders/${purchaseOrder.id}/download`}
                        className="rounded border border-slate-300 px-3 py-1 text-sm"
                      >
                        {t("shipment")} PDF
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 overflow-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-200 px-2 py-1 text-left">No</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">{t("product")}</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">Spec</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">Unit</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">{t("total")}</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">{t("message")}</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">{t("supplier")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="border border-slate-200 px-2 py-1">{idx + 1}</td>
                          <td className="border border-slate-200 px-2 py-1">
                            {item.product_name_snapshot}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {item.spec_snapshot}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {item.unit_snapshot}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">{item.qty}</td>
                          <td className="border border-slate-200 px-2 py-1">{item.memo ?? ""}</td>
                          <td className="border border-slate-200 px-2 py-1">
                            <div className="flex gap-2">
                              <select
                                className="rounded border border-slate-300 px-2 py-1"
                                value={selectedSupplierMap[item.id] ?? supplierRow.supplier_id}
                                disabled={statusChangeDisabled}
                                onChange={(event) =>
                                  setSelectedSupplierMap((prev) => ({
                                    ...prev,
                                    [item.id]: Number(event.target.value),
                                  }))
                                }
                              >
                                {supplierOptions.map((supplier) => (
                                  <option key={supplier.id} value={supplier.id}>
                                    {supplier.supplier_name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                                disabled={statusChangeDisabled || assigningItemId === item.id}
                                onClick={() => assignOrderItem(item.id)}
                              >
                                {assigningItemId === item.id ? t("loading") : t("confirm")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{t("tax_invoices")}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t("tax_invoices")}
        </p>
        {order.tax_invoices.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t("no_data")}</p>
        ) : (
          <div className="mt-3 space-y-4">
            {Object.entries(groupedInvoices).map(([supplierName, invoices]) => (
              <article key={supplierName} className="rounded border border-slate-200 p-3">
                <h3 className="text-sm font-semibold text-slate-900">{supplierName}</h3>
                <div className="mt-2 space-y-2">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="rounded border border-slate-200 p-2">
                      <p className="text-xs text-slate-500">
                        {invoice.email_inbox.from_email} /{" "}
                        {new Date(invoice.email_inbox.received_at).toLocaleString()} /{" "}
                        {invoice.order_link_type === "AUTO"
                          ? "AUTO"
                          : invoice.order_link_type === "MANUAL"
                            ? "MANUAL"
                            : "-"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {invoice.files.length === 0 ? (
                          <span className="text-xs text-slate-400">{t("no_data")}</span>
                        ) : (
                          invoice.files.map((file) => (
                            <a
                              key={file.id}
                              href={`/api/admin/tax-invoices/files/${file.id}/download`}
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              {file.file_type} {t("download")}
                            </a>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
