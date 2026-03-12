"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type SupplierOrderDetail = {
  order_id: number;
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
  order: {
    order_no: string;
    status: string;
    created_at: string;
    memo: string | null;
    buyer: { name: string };
    country: { country_name: string };
    order_items: Array<{
      id: number;
      product_code_snapshot: string;
      product_name_snapshot: string;
      spec_snapshot: string;
      unit_snapshot: string;
      qty: string;
      memo: string | null;
    }>;
  };
};

const statusLabelMap: Record<
  "WAITING" | "SENT" | "SUPPLIER_CONFIRMED" | "DELIVERING" | "COMPLETED" | "CANCELLED",
  string
> = {
  WAITING: "발송 대기",
  SENT: "발송 완료",
  SUPPLIER_CONFIRMED: "공급사 확인",
  DELIVERING: "납품 진행",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}

export default function SupplierOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);

  const [detail, setDetail] = useState<SupplierOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [updatingDelivery, setUpdatingDelivery] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmDate, setConfirmDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [supplierNote, setSupplierNote] = useState("");

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "주문 상세 조회 실패");
      }
      const payload = result.data as SupplierOrderDetail;
      setDetail(payload);
      setConfirmDate(toDateInputValue(payload.expected_delivery_date));
      setDeliveryDate(toDateInputValue(payload.expected_delivery_date));
      setSupplierNote(payload.supplier_note ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 상세 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isNaN(orderId)) {
      loadDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleConfirmOrder() {
    if (!detail) {
      return;
    }
    setMessage(null);
    setActionError(null);
    setConfirming(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedDeliveryDate: confirmDate || null,
          supplierNote: supplierNote || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "발주 확인 처리 실패");
      }
      setMessage("발주 확인 처리가 완료되었습니다.");
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "발주 확인 처리 실패");
    } finally {
      setConfirming(false);
    }
  }

  async function handleUpdateDeliveryDate() {
    setMessage(null);
    setActionError(null);
    if (!deliveryDate) {
      setActionError("납기 예정일을 입력해 주세요.");
      return;
    }
    setUpdatingDelivery(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedDeliveryDate: deliveryDate,
          supplierNote: supplierNote || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "납기 입력 실패");
      }
      setMessage("납기 예정일이 저장되었습니다.");
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "납기 입력 실패");
    } finally {
      setUpdatingDelivery(false);
    }
  }

  async function handleCancelOrder() {
    if (!detail) {
      return;
    }
    setMessage(null);
    setActionError(null);
    setCancelling(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: supplierNote || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "발주 취소 실패");
      }
      setMessage("발주 취소 처리가 완료되었습니다.");
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "발주 취소 실패");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">주문 상세를 불러오는 중...</p>;
  }
  if (error || !detail) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error ?? "주문 없음"}</p>;
  }

  const canConfirm = detail.status === "SENT";
  const canSetDelivery = detail.status === "SUPPLIER_CONFIRMED" || detail.status === "DELIVERING";
  const canCancel = detail.status === "SENT" || detail.status === "SUPPLIER_CONFIRMED";

  return (
    <div className="space-y-4">
      <header className="rounded border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">{detail.order.order_no}</h1>
        <p className="mt-1 text-sm text-slate-600">
          바이어: {detail.order.buyer.name} / 국가: {detail.order.country.country_name}
        </p>
        <p className="mt-1 text-sm text-slate-600">발주 상태: {statusLabelMap[detail.status]}</p>
        <p className="mt-1 text-xs text-slate-500">
          발송일: {detail.sent_at ? new Date(detail.sent_at).toLocaleString() : "-"} / 확인일:{" "}
          {detail.supplier_confirmed_at
            ? new Date(detail.supplier_confirmed_at).toLocaleString()
            : "-"}
        </p>
      </header>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">공급사 처리</h2>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            확인 시 납기 예정일
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={confirmDate}
              onChange={(event) => setConfirmDate(event.target.value)}
              disabled={!canConfirm || confirming}
            />
          </label>

          <label className="text-sm text-slate-700">
            납기 예정일(수정)
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
              disabled={!canSetDelivery || updatingDelivery}
            />
          </label>
        </div>

        <label className="mt-3 block text-sm text-slate-700">
          공급사 메모
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            rows={3}
            value={supplierNote}
            onChange={(event) => setSupplierNote(event.target.value)}
            disabled={confirming || updatingDelivery}
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={handleConfirmOrder}
            disabled={!canConfirm || confirming}
          >
            {confirming ? "처리 중..." : "발주 확인"}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            onClick={handleUpdateDeliveryDate}
            disabled={!canSetDelivery || updatingDelivery}
          >
            {updatingDelivery ? "저장 중..." : "납기 입력"}
          </button>
          <button
            type="button"
            className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-60"
            onClick={handleCancelOrder}
            disabled={!canCancel || cancelling}
          >
            {cancelling ? "취소 처리 중..." : "발주 취소"}
          </button>
        </div>

        {message ? <p className="mt-2 rounded bg-emerald-50 p-2 text-xs text-emerald-700">{message}</p> : null}
        {actionError ? <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{actionError}</p> : null}
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">품목</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">No</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상품코드</th>
                <th className="border border-slate-200 px-2 py-1 text-left">제품명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
                <th className="border border-slate-200 px-2 py-1 text-left">단위</th>
                <th className="border border-slate-200 px-2 py-1 text-left">수량</th>
                <th className="border border-slate-200 px-2 py-1 text-left">메모</th>
              </tr>
            </thead>
            <tbody>
              {detail.order.order_items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-slate-200 px-2 py-1">{index + 1}</td>
                  <td className="border border-slate-200 px-2 py-1">{item.product_code_snapshot}</td>
                  <td className="border border-slate-200 px-2 py-1">{item.product_name_snapshot}</td>
                  <td className="border border-slate-200 px-2 py-1">{item.spec_snapshot}</td>
                  <td className="border border-slate-200 px-2 py-1">{item.unit_snapshot}</td>
                  <td className="border border-slate-200 px-2 py-1">{item.qty}</td>
                  <td className="border border-slate-200 px-2 py-1">{item.memo ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
