"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

type OsRowStatus =
  | "PENDING"
  | "SENT"
  | "VIEWED"
  | "CONFIRMED"
  | "REJECTED"
  | "SHIPPING"
  | "COMPLETED"
  | "CANCELLED";

const osStatusLabel: Record<OsRowStatus, string> = {
  PENDING: "대기",
  SENT: "발송됨",
  VIEWED: "확인함",
  CONFIRMED: "수락",
  REJECTED: "거절",
  SHIPPING: "배송 중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

function buyerBadgeClass(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-[#2d333d] text-gray-300";
    case "SENT":
      return "bg-sky-950/40 text-sky-300";
    case "VIEWED":
      return "bg-violet-950/40 text-violet-300";
    case "CONFIRMED":
      return "bg-emerald-950/40 text-emerald-300";
    case "REJECTED":
      return "bg-red-950/40 text-red-300";
    case "SHIPPING":
      return "bg-orange-950/40 text-orange-300";
    case "COMPLETED":
      return "bg-green-800 text-white";
    case "CANCELLED":
      return "bg-[#3d4450] text-gray-400";
    default:
      return "bg-[#2d333d] text-gray-300";
  }
}

type BuyerOrderDetail = {
  id: number;
  order_no: string;
  status: string;
  buyer_status: string;
  created_at: string;
  memo: string | null;
  buyer: { name: string };
  country: { country_name: string; country_code: string };
  order_items: Array<{
    id: number;
    product_code_snapshot: string;
    product_name_snapshot: string;
    unit_snapshot: string;
    qty: string;
  }>;
  suppliers: Array<{
    id: number;
    supplier_id: number;
    status: string;
    pdf_status: string;
    email_status: string;
    pdf_last_error: string | null;
    email_last_error: string | null;
    supplier: {
      id: number;
      supplier_name: string;
      company_name: string | null;
    };
    shipments: Array<{
      id: number;
      shipment_no: string;
      status: string;
      supplier_status: string;
      status_logs: Array<{
        id: number;
        status_message: string;
        created_at: string;
        creator: {
          id: number;
          name: string;
        };
      }>;
    }>;
  }>;
};

type TimelineRow = {
  id: string;
  created_at: string;
  status_message: string;
  supplier_name: string;
  shipment_no: string;
};

export default function BuyerOrderDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const [detail, setDetail] = useState<BuyerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState<"combined" | number | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pdfRegenBusy, setPdfRegenBusy] = useState<number | null>(null);
  const [pdfRegenNotice, setPdfRegenNotice] = useState<string | null>(null);
  const [pdfRegenError, setPdfRegenError] = useState<string | null>(null);

  async function loadOrderDetail() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/buyer/orders/${orderId}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setDetail(result.data as BuyerOrderDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isNaN(orderId)) {
      void loadOrderDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const timeline = useMemo(() => {
    if (!detail) {
      return [] as TimelineRow[];
    }
    const rows: TimelineRow[] = [];
    for (const supplierRow of detail.suppliers) {
      for (const shipment of supplierRow.shipments) {
        for (const log of shipment.status_logs) {
          rows.push({
            id: `${shipment.id}-${log.id}`,
            created_at: log.created_at,
            status_message: log.status_message,
            supplier_name: supplierRow.supplier.supplier_name,
            shipment_no: shipment.shipment_no,
          });
        }
      }
    }
    rows.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return rows;
  }, [detail]);

  async function postPoEmail(url: string, busyKey: "combined" | number) {
    setEmailBusy(busyKey);
    setEmailNotice(null);
    setEmailError(null);
    try {
      const response = await fetch(url, { method: "POST", credentials: "include" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("po_email_fail"));
      }
      setEmailNotice(t("po_email_ok"));
      await loadOrderDetail();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : t("po_email_fail"));
    } finally {
      setEmailBusy(null);
    }
  }

  async function postPdfRegenerate(orderSupplierId: number) {
    setPdfRegenBusy(orderSupplierId);
    setPdfRegenNotice(null);
    setPdfRegenError(null);
    try {
      const response = await fetch(
        `/api/buyer/orders/${orderId}/suppliers/${orderSupplierId}/pdf-regenerate`,
        { method: "POST", credentials: "include" },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "PDF 재생성 실패");
      }
      setPdfRegenNotice("PDF를 재생성했습니다.");
      await loadOrderDetail();
    } catch (err) {
      setPdfRegenError(err instanceof Error ? err.message : "PDF 재생성 실패");
    } finally {
      setPdfRegenBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">{t("loading")}</p>;
  }
  if (error || !detail) {
    return <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{error ?? t("not_found")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-white">{detail.order_no}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/buyer/orders/${orderId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            {t("po_pdf_combined")}
          </a>
          <button
            type="button"
            disabled={emailBusy !== null || pdfRegenBusy !== null}
            onClick={() =>
              postPoEmail(`/api/buyer/orders/${orderId}/po-email`, "combined")
            }
            className="rounded border border-[#2d333d] bg-[#1a1d23] px-3 py-1.5 text-sm text-gray-300 hover:bg-[#23272f] disabled:opacity-50"
          >
            {emailBusy === "combined" ? t("loading") : t("po_email_send_combined")}
          </button>
          <Link
            href="/buyer/orders"
            className="rounded border border-[#2d333d] px-3 py-1 text-sm text-gray-300"
          >
            {t("orders")}
          </Link>
        </div>
      </div>
      {emailNotice ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{emailNotice}</p>
      ) : null}
      {emailError ? (
        <p className="rounded bg-red-950/30 px-3 py-2 text-sm text-red-800">{emailError}</p>
      ) : null}
      {pdfRegenNotice ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{pdfRegenNotice}</p>
      ) : null}
      {pdfRegenError ? (
        <p className="rounded bg-red-950/30 px-3 py-2 text-sm text-red-800">{pdfRegenError}</p>
      ) : null}

      <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <h2 className="text-lg font-semibold text-white">공급사별 진행</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                <th className="border border-[#2d333d] px-2 py-2 text-left">공급사</th>
                <th className="border border-[#2d333d] px-2 py-2 text-left">상태</th>
                <th className="border border-[#2d333d] px-2 py-2 text-left">PDF</th>
                <th className="border border-[#2d333d] px-2 py-2 text-left">이메일</th>
                <th className="border border-[#2d333d] px-2 py-2 text-left">작업</th>
              </tr>
            </thead>
            <tbody>
              {detail.suppliers.map((s) => {
                const name =
                  s.supplier.company_name?.trim() || s.supplier.supplier_name;
                const st = (s.status in osStatusLabel ? s.status : "PENDING") as OsRowStatus;
                return (
                  <tr key={s.id}>
                    <td className="border border-[#2d333d] px-2 py-2 font-medium">{name}</td>
                    <td className="border border-[#2d333d] px-2 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${buyerBadgeClass(s.status)}`}
                      >
                        {osStatusLabel[st] ?? s.status}
                      </span>
                    </td>
                    <td className="border border-[#2d333d] px-2 py-2 text-xs">
                      <span className="font-mono">{s.pdf_status}</span>
                      {s.pdf_last_error ? (
                        <p className="mt-1 text-red-400">{s.pdf_last_error}</p>
                      ) : null}
                    </td>
                    <td className="border border-[#2d333d] px-2 py-2 text-xs">
                      <span className="font-mono">{s.email_status}</span>
                      {s.email_last_error ? (
                        <p className="mt-1 text-red-400">{s.email_last_error}</p>
                      ) : null}
                    </td>
                    <td className="border border-[#2d333d] px-2 py-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
                        <a
                          href={`/api/buyer/orders/${orderId}/suppliers/${s.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block rounded border border-[#2d333d] px-2 py-1 text-center text-gray-300 hover:bg-[#23272f]"
                        >
                          PDF
                        </a>
                        <button
                          type="button"
                          disabled={emailBusy !== null || pdfRegenBusy !== null}
                          onClick={() =>
                            postPoEmail(
                              `/api/buyer/orders/${orderId}/suppliers/${s.id}/po-email`,
                              s.id,
                            )
                          }
                          className="rounded border border-[#2d333d] px-2 py-1 text-gray-300 hover:bg-[#23272f] disabled:opacity-50"
                        >
                          {emailBusy === s.id ? t("loading") : "이메일 재전송"}
                        </button>
                        <button
                          type="button"
                          disabled={emailBusy !== null || pdfRegenBusy !== null}
                          onClick={() => postPdfRegenerate(s.id)}
                          className="rounded border border-amber-600 px-2 py-1 text-amber-200 hover:bg-amber-950/30 disabled:opacity-50"
                        >
                          {pdfRegenBusy === s.id ? t("loading") : "PDF 재생성"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {detail.suppliers.length === 0 ? (
                <tr>
                  <td className="border border-[#2d333d] px-2 py-4 text-center text-gray-400" colSpan={5}>
                    {t("no_data")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-sm text-gray-400">
        {t("status")}: {detail.status} / {t("payment_status")}: {detail.buyer_status} / {t("buyer")}: {detail.buyer.name} / {t("country")}:{" "}
        {detail.country.country_name} ({detail.country.country_code})
      </p>

      <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <h2 className="text-lg font-semibold">{t("order_summary")}</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
          <div className="rounded bg-[#111318] p-2">
            <p className="text-xs text-gray-400">{t("order_number")}</p>
            <p className="font-semibold text-white">{detail.order_no}</p>
          </div>
          <div className="rounded bg-[#111318] p-2">
            <p className="text-xs text-gray-400">{t("order_date")}</p>
            <p className="font-semibold text-white">{new Date(detail.created_at).toLocaleString()}</p>
          </div>
          <div className="rounded bg-[#111318] p-2">
            <p className="text-xs text-gray-400">{t("order_status")}</p>
            <p className="font-semibold text-white">{detail.status}</p>
          </div>
          <div className="rounded bg-[#111318] p-2">
            <p className="text-xs text-gray-400">{t("payment_status")}</p>
            <p className="font-semibold text-white">{detail.buyer_status}</p>
          </div>
        </div>

        <h3 className="mt-4 text-sm font-semibold text-white">{t("products")}</h3>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                <th className="border border-[#2d333d] px-2 py-1 text-left">Code</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("product")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.order_items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-[#2d333d] px-2 py-1">{item.product_code_snapshot}</td>
                  <td className="border border-[#2d333d] px-2 py-1">{item.product_name_snapshot}</td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {item.qty} {item.unit_snapshot}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <h2 className="text-lg font-semibold">{t("supplier_shipments")}</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#111318]">
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("supplier")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("shipment")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("shipment_status")}</th>
                <th className="border border-[#2d333d] px-2 py-1 text-left">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.suppliers.flatMap((supplierRow) =>
                supplierRow.shipments.map((shipment) => (
                  <tr key={shipment.id}>
                    <td className="border border-[#2d333d] px-2 py-1">
                      {supplierRow.supplier.supplier_name}
                    </td>
                    <td className="border border-[#2d333d] px-2 py-1">{shipment.shipment_no}</td>
                    <td className="border border-[#2d333d] px-2 py-1">{shipment.status}</td>
                    <td className="border border-[#2d333d] px-2 py-1">{shipment.supplier_status}</td>
                  </tr>
                )),
              )}
              {detail.suppliers.every((supplierRow) => supplierRow.shipments.length === 0) ? (
                <tr>
                  <td className="border border-[#2d333d] px-2 py-3 text-center text-gray-400" colSpan={4}>
                    {t("no_data")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <h2 className="text-lg font-semibold">{t("shipment_timeline")}</h2>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">{t("no_data")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {timeline.map((row) => (
              <li key={row.id} className="rounded bg-[#111318] px-2 py-1 text-gray-300">
                {new Date(row.created_at).toLocaleString()} {row.status_message} ({row.supplier_name} /{" "}
                {row.shipment_no})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
