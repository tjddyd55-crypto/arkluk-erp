"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

type SupplierOrderDetail = {
  id: number;
  order_id: number;
  status:
    | "PENDING"
    | "SENT"
    | "VIEWED"
    | "CONFIRMED"
    | "SHIPPING"
    | "COMPLETED"
    | "CANCELLED"
    | "REJECTED";
  pdf_status: string;
  email_status: string;
  pdf_last_error: string | null;
  email_last_error: string | null;
  tracking_number: string | null;
  reject_reason: string | null;
  sent_at: string | null;
  supplier_confirmed_at: string | null;
  expected_delivery_date: string | null;
  supplier_note: string | null;
  supplier: {
    supplier_name: string;
    company_name: string | null;
  };
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

type ShipmentRow = {
  id: number;
  shipment_no: string;
  carrier: string | null;
  tracking_number: string | null;
  status: "CREATED" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  supplier_status: "CONFIRMED" | "PREPARING" | "PACKING" | "SHIPPED" | "DELIVERED" | "HOLD";
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  items: Array<{
    id: number;
    quantity: string;
    order_item: {
      id: number;
      product_code_snapshot: string;
      product_name_snapshot: string;
      unit_snapshot: string;
      qty: string;
    };
  }>;
  status_logs: Array<{
    id: number;
    status_message: string;
    created_at: string;
    creator: {
      id: number;
      name: string;
    };
  }>;
};

const statusLabelMap: Record<SupplierOrderDetail["status"], string> = {
  PENDING: "대기",
  SENT: "발송됨",
  VIEWED: "확인함",
  CONFIRMED: "수락",
  SHIPPING: "배송 중",
  COMPLETED: "완료",
  CANCELLED: "취소",
  REJECTED: "거절",
};

function badgeClassForOsStatus(status: SupplierOrderDetail["status"]) {
  switch (status) {
    case "PENDING":
      return "bg-slate-200 text-slate-800";
    case "SENT":
      return "bg-blue-100 text-blue-900";
    case "VIEWED":
      return "bg-violet-100 text-violet-900";
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-900";
    case "REJECTED":
      return "bg-red-100 text-red-900";
    case "SHIPPING":
      return "bg-orange-100 text-orange-900";
    case "COMPLETED":
      return "bg-green-800 text-white";
    case "CANCELLED":
      return "bg-slate-300 text-slate-800";
    default:
      return "bg-slate-200 text-slate-800";
  }
}

function labelForPdfStatus(v: string) {
  if (v === "SUCCESS") return "성공";
  if (v === "FAILED") return "실패";
  return "준비 중";
}

function labelForEmailStatus(v: string) {
  if (v === "SENT") return "발송됨";
  if (v === "FAILED") return "실패";
  return "대기";
}

const shipmentStatusLabelMap: Record<
  "CREATED" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED",
  string
> = {
  CREATED: "생성됨",
  SHIPPED: "출고됨",
  IN_TRANSIT: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소",
};

const supplierShipmentStatusOptions: Array<
  "CONFIRMED" | "PREPARING" | "PACKING" | "SHIPPED" | "DELIVERED" | "HOLD"
> = ["CONFIRMED", "PREPARING", "PACKING", "SHIPPED", "DELIVERED", "HOLD"];

function getSupplierStatusLabel(status: SupplierOrderDetail["status"], orderStatus: string) {
  if (status === "PENDING" && orderStatus === "ASSIGNED") {
    return "배정 완료";
  }
  return statusLabelMap[status];
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}

export default function SupplierOrderDetailPage() {
  const { t } = useTranslation();
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
  const [shipping, setShipping] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [confirmDate, setConfirmDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [supplierNote, setSupplierNote] = useState("");
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [processingShipmentId, setProcessingShipmentId] = useState<number | null>(null);
  const [shipmentCarrier, setShipmentCarrier] = useState("");
  const [shipmentTrackingNumber, setShipmentTrackingNumber] = useState("");
  const [shipmentQtyMap, setShipmentQtyMap] = useState<Record<number, string>>({});
  const [shipmentStatusMessageMap, setShipmentStatusMessageMap] = useState<Record<number, string>>({});
  const [shipmentWorkflowStatusMap, setShipmentWorkflowStatusMap] = useState<
    Record<number, ShipmentRow["supplier_status"]>
  >({});
  const [rejecting, setRejecting] = useState(false);
  const [rejectReasonInput, setRejectReasonInput] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [regeneratingPdf, setRegeneratingPdf] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      const payload = result.data as SupplierOrderDetail;
      setDetail(payload);
      setConfirmDate(toDateInputValue(payload.expected_delivery_date));
      setDeliveryDate(toDateInputValue(payload.expected_delivery_date));
      setSupplierNote(payload.supplier_note ?? "");
      setTrackingInput(payload.tracking_number ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }

  /** 상세 조회 후 열람 처리(SENT→VIEWED) — 서버 상태만 갱신 */
  async function loadDetailWithViewMark() {
    setLoading(true);
    setError(null);
    try {
      const first = await fetch(`/api/supplier/orders/${orderId}`);
      const firstJson = await first.json();
      if (!first.ok || !firstJson.success) {
        throw new Error(firstJson.message ?? t("error"));
      }
      const firstPayload = firstJson.data as SupplierOrderDetail;
      setDetail(firstPayload);
      setConfirmDate(toDateInputValue(firstPayload.expected_delivery_date));
      setDeliveryDate(toDateInputValue(firstPayload.expected_delivery_date));
      setSupplierNote(firstPayload.supplier_note ?? "");
      setTrackingInput(firstPayload.tracking_number ?? "");

      await fetch(`/api/supplier/orders/${orderId}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      const second = await fetch(`/api/supplier/orders/${orderId}`);
      const secondJson = await second.json();
      if (!second.ok || !secondJson.success) {
        throw new Error(secondJson.message ?? t("error"));
      }
      const payload = secondJson.data as SupplierOrderDetail;
      setDetail(payload);
      setConfirmDate(toDateInputValue(payload.expected_delivery_date));
      setDeliveryDate(toDateInputValue(payload.expected_delivery_date));
      setSupplierNote(payload.supplier_note ?? "");
      setTrackingInput(payload.tracking_number ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }

  async function loadShipments() {
    setLoadingShipments(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/shipments`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      const rows = result.data as ShipmentRow[];
      setShipments(rows);
      setShipmentWorkflowStatusMap(
        rows.reduce<Record<number, ShipmentRow["supplier_status"]>>((acc, row) => {
          acc[row.id] = row.supplier_status;
          return acc;
        }, {}),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoadingShipments(false);
    }
  }

  useEffect(() => {
    if (!Number.isNaN(orderId)) {
      void loadDetailWithViewMark();
      loadShipments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleCreateShipment() {
    if (!detail) {
      return;
    }
    setMessage(null);
    setActionError(null);

    const shipmentItems = detail.order.order_items
      .map((item) => ({
        orderItemId: item.id,
        quantity: Number(shipmentQtyMap[item.id] ?? 0),
      }))
      .filter((row) => row.quantity > 0);
    if (shipmentItems.length === 0) {
      setActionError("출고할 품목 수량을 1개 이상 입력해 주세요.");
      return;
    }

    setCreatingShipment(true);
    try {
      const createResponse = await fetch(`/api/supplier/orders/${orderId}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: shipmentCarrier || null,
          trackingNumber: shipmentTrackingNumber || null,
        }),
      });
      const createResult = await createResponse.json();
      if (!createResponse.ok || !createResult.success) {
        throw new Error(createResult.message ?? "출고 생성 실패");
      }

      const createdShipmentId = Number((createResult.data as { id: number }).id);
      for (const item of shipmentItems) {
        const addItemResponse = await fetch(
          `/api/supplier/orders/${orderId}/shipments/${createdShipmentId}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          },
        );
        const addItemResult = await addItemResponse.json();
        if (!addItemResponse.ok || !addItemResult.success) {
          throw new Error(addItemResult.message ?? "출고 품목 추가 실패");
        }
      }

      setMessage("Shipment가 생성되었습니다.");
      setShipmentCarrier("");
      setShipmentTrackingNumber("");
      setShipmentQtyMap({});
      setShipmentStatusMessageMap({});
      await loadShipments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Shipment 생성 실패");
    } finally {
      setCreatingShipment(false);
    }
  }

  async function handleMarkShipmentShipped(shipmentId: number) {
    setMessage(null);
    setActionError(null);
    setProcessingShipmentId(shipmentId);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/shipments/${shipmentId}/ship`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Shipment 출고 처리 실패");
      }

      setMessage("Shipment 상태를 SHIPPED로 변경했습니다.");
      await loadShipments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Shipment 출고 처리 실패");
    } finally {
      setProcessingShipmentId(null);
    }
  }

  async function handleMarkShipmentDelivered(shipmentId: number) {
    setMessage(null);
    setActionError(null);
    setProcessingShipmentId(shipmentId);
    try {
      const response = await fetch(
        `/api/supplier/orders/${orderId}/shipments/${shipmentId}/deliver`,
        {
          method: "POST",
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Shipment 배송 완료 처리 실패");
      }

      setMessage("Shipment 상태를 DELIVERED로 변경했습니다.");
      await loadShipments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Shipment 배송 완료 처리 실패");
    } finally {
      setProcessingShipmentId(null);
    }
  }

  async function handleAddShipmentStatus(shipmentId: number) {
    const message = (shipmentStatusMessageMap[shipmentId] ?? "").trim();
    if (!message) {
      setActionError("상태 메시지를 입력해 주세요.");
      return;
    }

    setMessage(null);
    setActionError(null);
    setProcessingShipmentId(shipmentId);
    try {
      const response = await fetch(
        `/api/supplier/orders/${orderId}/shipments/${shipmentId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statusMessage: message,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Shipment 상태 메시지 추가 실패");
      }

      setShipmentStatusMessageMap((prev) => ({
        ...prev,
        [shipmentId]: "",
      }));
      setMessage("Shipment 상태 메시지를 기록했습니다.");
      await loadShipments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Shipment 상태 메시지 추가 실패");
    } finally {
      setProcessingShipmentId(null);
    }
  }

  async function handleUpdateShipmentWorkflowStatus(shipmentId: number) {
    const status = shipmentWorkflowStatusMap[shipmentId];
    if (!status) {
      setActionError("변경할 배송 상태를 선택해 주세요.");
      return;
    }

    setMessage(null);
    setActionError(null);
    setProcessingShipmentId(shipmentId);
    try {
      const response = await fetch(
        `/api/supplier/orders/${orderId}/shipments/${shipmentId}/supplier-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            statusMessage: shipmentStatusMessageMap[shipmentId] ?? null,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Shipment 상태 변경 실패");
      }

      setMessage("Shipment 배송 상태가 변경되었습니다.");
      setShipmentStatusMessageMap((prev) => ({ ...prev, [shipmentId]: "" }));
      await loadShipments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Shipment 상태 변경 실패");
    } finally {
      setProcessingShipmentId(null);
    }
  }

  async function handleAcceptOrder() {
    if (!detail) {
      return;
    }
    setMessage(null);
    setActionError(null);
    setConfirming(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedDeliveryDate: confirmDate || null,
          supplierNote: supplierNote || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "수락 처리 실패");
      }
      setMessage("발주를 수락했습니다.");
      await loadDetailWithViewMark();
      await loadShipments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "수락 처리 실패");
    } finally {
      setConfirming(false);
    }
  }

  async function handleRejectOrder() {
    setMessage(null);
    setActionError(null);
    setRejecting(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectReason: rejectReasonInput.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "거절 처리 실패");
      }
      setMessage("발주를 거절했습니다.");
      setRejectReasonInput("");
      await loadDetailWithViewMark();
      await loadShipments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "거절 처리 실패");
    } finally {
      setRejecting(false);
    }
  }

  async function handleRegeneratePdf() {
    setMessage(null);
    setActionError(null);
    setRegeneratingPdf(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/pdf-regenerate`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "PDF 재생성 실패");
      }
      setMessage("PDF를 재생성했습니다.");
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "PDF 재생성 실패");
    } finally {
      setRegeneratingPdf(false);
    }
  }

  async function handleResendPoEmail() {
    setMessage(null);
    setActionError(null);
    setResendingEmail(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/po-email`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "이메일 재전송 실패");
      }
      setMessage(result.data?.mocked ? "모의 발송으로 기록했습니다." : "이메일을 재전송했습니다.");
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "이메일 재전송 실패");
    } finally {
      setResendingEmail(false);
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
      await loadDetailWithViewMark();
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
      await loadDetailWithViewMark();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "발주 취소 실패");
    } finally {
      setCancelling(false);
    }
  }

  async function handleMarkShipped() {
    if (!detail) {
      return;
    }
    setMessage(null);
    setActionError(null);
    setShipping(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierNote: supplierNote || null,
          trackingNumber: trackingInput.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "출고 처리 실패");
      }
      setMessage("배송을 시작했습니다.");
      await loadDetailWithViewMark();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "출고 처리 실패");
    } finally {
      setShipping(false);
    }
  }

  async function handleMarkDelivered() {
    if (!detail) {
      return;
    }
    setMessage(null);
    setActionError(null);
    setDelivering(true);
    try {
      const response = await fetch(`/api/supplier/orders/${orderId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierNote: supplierNote || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "납품 완료 처리 실패");
      }
      setMessage("납품 완료 처리되었습니다.");
      await loadDetailWithViewMark();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "납품 완료 처리 실패");
    } finally {
      setDelivering(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">{t("loading")}</p>;
  }
  if (error || !detail) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error ?? t("not_found")}</p>;
  }

  const st = detail.status;
  const canAccept = st === "PENDING" || st === "SENT" || st === "VIEWED";
  const canReject = st !== "COMPLETED";
  const canShip = st === "CONFIRMED";
  const canDeliver = st === "SHIPPING";
  const canSetDelivery =
    Boolean(detail.supplier_confirmed_at) &&
    st !== "COMPLETED" &&
    st !== "CANCELLED" &&
    st !== "REJECTED";
  const canCancel = st === "SENT" || st === "VIEWED" || st === "CONFIRMED";

  const supplierDisplayName =
    detail.supplier.company_name?.trim() || detail.supplier.supplier_name;

  return (
    <div className="space-y-4">
      <header className="rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{detail.order.order_no}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClassForOsStatus(detail.status)}`}
          >
            {getSupplierStatusLabel(detail.status, detail.order.status)}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-800">공급사: {supplierDisplayName}</p>
        <p className="mt-1 text-sm text-slate-600">
          {t("buyer")}: {detail.order.buyer.name} / {t("country")}: {detail.order.country.country_name}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          주문(통합) 상태: <span className="font-mono text-xs">{detail.order.status}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="rounded bg-slate-100 px-2 py-1 text-slate-800">
            PDF: {labelForPdfStatus(detail.pdf_status)}
          </span>
          <span className="rounded bg-slate-100 px-2 py-1 text-slate-800">
            이메일: {labelForEmailStatus(detail.email_status)}
          </span>
        </div>
        {detail.pdf_status === "FAILED" && detail.pdf_last_error ? (
          <p className="mt-1 text-xs text-red-600">PDF 오류: {detail.pdf_last_error}</p>
        ) : null}
        {detail.email_status === "FAILED" && detail.email_last_error ? (
          <p className="mt-1 text-xs text-red-600">메일 오류: {detail.email_last_error}</p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          발송일: {detail.sent_at ? new Date(detail.sent_at).toLocaleString() : "-"} / 수락일:{" "}
          {detail.supplier_confirmed_at
            ? new Date(detail.supplier_confirmed_at).toLocaleString()
            : "-"}
        </p>
        {detail.tracking_number ? (
          <p className="mt-1 text-xs text-slate-600">운송장: {detail.tracking_number}</p>
        ) : null}
        {detail.reject_reason ? (
          <p className="mt-1 text-xs text-red-700">거절 사유: {detail.reject_reason}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`/api/supplier/orders/${orderId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            {t("po_pdf_download")}
          </a>
          {detail.pdf_status === "FAILED" ? (
            <button
              type="button"
              className="rounded border border-amber-600 px-3 py-1.5 text-sm text-amber-900 disabled:opacity-60"
              disabled={regeneratingPdf}
              onClick={handleRegeneratePdf}
            >
              {regeneratingPdf ? "처리 중..." : "PDF 재생성"}
            </button>
          ) : null}
          {detail.email_status === "FAILED" ? (
            <button
              type="button"
              className="rounded border border-amber-600 px-3 py-1.5 text-sm text-amber-900 disabled:opacity-60"
              disabled={resendingEmail}
              onClick={handleResendPoEmail}
            >
              {resendingEmail ? "처리 중..." : "이메일 재전송"}
            </button>
          ) : null}
        </div>
      </header>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">
          {t("supplier")} {t("actions")}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          상태는 서버에서만 변경됩니다. 처리 후 목록이 자동으로 갱신됩니다.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            수락 시 납기 예정일(선택)
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={confirmDate}
              onChange={(event) => setConfirmDate(event.target.value)}
              disabled={!canAccept || confirming}
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
          배송 시작 시 운송장 번호
          <input
            type="text"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            value={trackingInput}
            onChange={(event) => setTrackingInput(event.target.value)}
            disabled={!canShip || shipping}
            placeholder="선택 입력"
          />
        </label>

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

        {canReject && st !== "REJECTED" ? (
          <label className="mt-3 block text-sm text-slate-700">
            거절 사유(선택)
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              rows={2}
              value={rejectReasonInput}
              onChange={(event) => setRejectReasonInput(event.target.value)}
              disabled={rejecting}
            />
          </label>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={handleAcceptOrder}
            disabled={!canAccept || confirming}
          >
            {confirming ? "처리 중..." : "수락"}
          </button>
          <button
            type="button"
            className="rounded border border-red-400 px-3 py-2 text-sm text-red-800 disabled:opacity-60"
            onClick={handleRejectOrder}
            disabled={st === "COMPLETED" || rejecting}
          >
            {rejecting ? "처리 중..." : "거절"}
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
            className="rounded border border-orange-400 px-3 py-2 text-sm text-orange-900 disabled:opacity-60"
            onClick={handleMarkShipped}
            disabled={!canShip || shipping}
          >
            {shipping ? "처리 중..." : "배송 시작"}
          </button>
          <button
            type="button"
            className="rounded border border-emerald-600 px-3 py-2 text-sm text-emerald-900 disabled:opacity-60"
            onClick={handleMarkDelivered}
            disabled={!canDeliver || delivering}
          >
            {delivering ? "처리 중..." : "완료"}
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
        <h2 className="text-lg font-semibold">{t("products")}</h2>
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

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{t("shipment")}</h2>
        <p className="mt-1 text-xs text-slate-500">
          기존 주문 상태와 독립적으로, 부분 출고 및 송장 추적을 위한 Shipment를 생성합니다.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Carrier
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              placeholder="예: DHL, FedEx"
              value={shipmentCarrier}
              onChange={(event) => setShipmentCarrier(event.target.value)}
              disabled={creatingShipment}
            />
          </label>
          <label className="text-sm text-slate-700">
            Tracking Number
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              placeholder="운송장 번호"
              value={shipmentTrackingNumber}
              onChange={(event) => setShipmentTrackingNumber(event.target.value)}
              disabled={creatingShipment}
            />
          </label>
        </div>

        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">상품코드</th>
                <th className="border border-slate-200 px-2 py-1 text-left">제품명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">주문수량</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Shipment Items</th>
              </tr>
            </thead>
            <tbody>
              {detail.order.order_items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-200 px-2 py-1">{item.product_code_snapshot}</td>
                  <td className="border border-slate-200 px-2 py-1">{item.product_name_snapshot}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {item.qty} {item.unit_snapshot}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      className="w-28 rounded border border-slate-300 px-2 py-1"
                      value={shipmentQtyMap[item.id] ?? ""}
                      onChange={(event) =>
                        setShipmentQtyMap((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      disabled={creatingShipment}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={handleCreateShipment}
            disabled={creatingShipment}
          >
            {creatingShipment ? "생성 중..." : "Create Shipment"}
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">Shipment 목록</h3>
          {loadingShipments ? (
            <p className="mt-2 text-xs text-slate-500">출고 목록을 불러오는 중...</p>
          ) : shipments.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">생성된 Shipment가 없습니다.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {shipments.map((shipment) => (
                <article key={shipment.id} className="rounded border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {shipment.shipment_no} ({shipmentStatusLabelMap[shipment.status]} /{" "}
                        {shipment.supplier_status})
                      </p>
                      <p className="text-xs text-slate-500">
                        Carrier: {shipment.carrier ?? "-"} / Tracking: {shipment.tracking_number ?? "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        생성일: {new Date(shipment.created_at).toLocaleString()} / 출고일:{" "}
                        {shipment.shipped_at ? new Date(shipment.shipped_at).toLocaleString() : "-"} / 배송완료일:{" "}
                        {shipment.delivered_at
                          ? new Date(shipment.delivered_at).toLocaleString()
                          : "-"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        value={shipmentWorkflowStatusMap[shipment.id] ?? shipment.supplier_status}
                        onChange={(event) =>
                          setShipmentWorkflowStatusMap((prev) => ({
                            ...prev,
                            [shipment.id]: event.target.value as ShipmentRow["supplier_status"],
                          }))
                        }
                        disabled={processingShipmentId === shipment.id}
                      >
                        {supplierShipmentStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                        disabled={processingShipmentId === shipment.id}
                        onClick={() => handleUpdateShipmentWorkflowStatus(shipment.id)}
                      >
                        {processingShipmentId === shipment.id ? "처리 중..." : "상태 반영"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700 disabled:opacity-60"
                        disabled={
                          processingShipmentId === shipment.id ||
                          (shipment.status !== "CREATED" && shipment.status !== "IN_TRANSIT")
                        }
                        onClick={() => handleMarkShipmentShipped(shipment.id)}
                      >
                        {processingShipmentId === shipment.id ? "처리 중..." : "SHIPPED"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-60"
                        disabled={
                          processingShipmentId === shipment.id ||
                          (shipment.status !== "SHIPPED" && shipment.status !== "IN_TRANSIT")
                        }
                        onClick={() => handleMarkShipmentDelivered(shipment.id)}
                      >
                        {processingShipmentId === shipment.id ? "처리 중..." : "DELIVERED"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 overflow-auto">
                    <table className="min-w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border border-slate-200 px-2 py-1 text-left">상품코드</th>
                          <th className="border border-slate-200 px-2 py-1 text-left">제품명</th>
                          <th className="border border-slate-200 px-2 py-1 text-left">출고수량</th>
                          <th className="border border-slate-200 px-2 py-1 text-left">주문수량</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shipment.items.map((item) => (
                          <tr key={item.id}>
                            <td className="border border-slate-200 px-2 py-1">
                              {item.order_item.product_code_snapshot}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {item.order_item.product_name_snapshot}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {item.quantity} {item.order_item.unit_snapshot}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {item.order_item.qty} {item.order_item.unit_snapshot}
                            </td>
                          </tr>
                        ))}
                        {shipment.items.length === 0 ? (
                          <tr>
                            <td
                              className="border border-slate-200 px-2 py-2 text-center text-slate-500"
                              colSpan={4}
                            >
                              출고 품목이 없습니다.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 rounded border border-slate-200 p-2">
                    <p className="text-xs font-semibold text-slate-700">{t("update_status")}</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                        placeholder="예: 상품 준비 중, 포장 완료, 발송 완료, 배송 중, 배송 완료"
                        value={shipmentStatusMessageMap[shipment.id] ?? ""}
                        onChange={(event) =>
                          setShipmentStatusMessageMap((prev) => ({
                            ...prev,
                            [shipment.id]: event.target.value,
                          }))
                        }
                        disabled={processingShipmentId === shipment.id}
                      />
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                        disabled={processingShipmentId === shipment.id}
                        onClick={() => handleAddShipmentStatus(shipment.id)}
                      >
                        {processingShipmentId === shipment.id ? "저장 중..." : "상태 추가"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded border border-slate-200 p-2">
                    <p className="text-xs font-semibold text-slate-700">{t("shipment_timeline")}</p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {shipment.status_logs.map((log) => (
                        <li key={log.id} className="rounded bg-slate-50 px-2 py-1">
                          {new Date(log.created_at).toLocaleString()} - {log.status_message} (
                          {log.creator.name})
                        </li>
                      ))}
                      {shipment.status_logs.length === 0 ? (
                        <li className="rounded bg-slate-50 px-2 py-1 text-slate-500">
                          상태 메시지가 없습니다.
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
