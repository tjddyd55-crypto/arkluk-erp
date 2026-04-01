"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type MailboxSummary = {
  supplierId: number | null;
  supplierName: string;
  count: number;
};

type TaxInvoiceRow = {
  id: number;
  supplier_id: number | null;
  order_id: number | null;
  order_link_type: "AUTO" | "MANUAL" | null;
  created_at: string;
  supplier: { supplier_name: string } | null;
  order: { id: number; order_no: string } | null;
  email_inbox: {
    from_email: string;
    received_at: string;
    subject: string;
    attachment_count: number;
  };
  files: Array<{
    id: number;
    file_name: string;
    file_type: "PDF" | "XML";
  }>;
};

type SupplierOption = {
  id: number;
  supplier_name: string;
};

type TaxInvoiceApiResponse = {
  success: boolean;
  data?: {
    mailbox: MailboxSummary[];
    invoices: TaxInvoiceRow[];
  };
  message?: string;
};

type LinkState = {
  orderNo: string;
  supplierId: string;
  pending: boolean;
  message: string | null;
  error: string | null;
};

export function TaxInvoiceMailbox() {
  const [supplierId, setSupplierId] = useState<string>("");
  const [unclassifiedOnly, setUnclassifiedOnly] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [fromEmail, setFromEmail] = useState<string>("");
  const [orderNo, setOrderNo] = useState<string>("");

  const [mailbox, setMailbox] = useState<MailboxSummary[]>([]);
  const [supplierList, setSupplierList] = useState<SupplierOption[]>([]);
  const [rows, setRows] = useState<TaxInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [linkState, setLinkState] = useState<Record<number, LinkState>>({});

  const supplierOptions = useMemo(
    () => mailbox.filter((box) => box.supplierId !== null),
    [mailbox],
  );

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const response = await fetch("/api/admin/suppliers");
        const result = await response.json();
        if (response.ok && result.success && Array.isArray(result.data)) {
          setSupplierList(
            result.data.map((supplier: { id: number; supplier_name: string }) => ({
              id: supplier.id,
              supplier_name: supplier.supplier_name,
            })),
          );
        }
      } catch {
        // Ignore supplier option load error in list view.
      }
    }
    loadSuppliers();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (supplierId) params.set("supplierId", supplierId);
      if (unclassifiedOnly) params.set("unclassified", "true");
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (fromEmail.trim()) params.set("fromEmail", fromEmail.trim());
      if (orderNo.trim()) params.set("orderNo", orderNo.trim());

      const response = await fetch(`/api/admin/tax-invoices?${params.toString()}`);
      const result = (await response.json()) as TaxInvoiceApiResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "세금계산서 조회 실패");
      }
      const payload = result.data;

      setMailbox(payload.mailbox);
      setRows(payload.invoices);
      setLinkState((prev) => {
        const next = { ...prev };
        for (const row of payload.invoices) {
          const prevRowState = next[row.id];
          next[row.id] = {
            orderNo: prevRowState?.orderNo ?? row.order?.order_no ?? "",
            supplierId: prevRowState?.supplierId ?? (row.supplier_id ? String(row.supplier_id) : ""),
            pending: prevRowState?.pending ?? false,
            message: prevRowState?.message ?? null,
            error: prevRowState?.error ?? null,
          };
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "세금계산서 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFilterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await loadInvoices();
  }

  async function runSync() {
    setSyncPending(true);
    setSyncMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/tax-invoices/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "메일 동기화 실패");
      }
      setSyncMessage(
        `동기화 완료 (수집 ${result.data.fetched}, 신규 ${result.data.created}, 주문연결 ${result.data.linkedOrder})`,
      );
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "메일 동기화 실패");
    } finally {
      setSyncPending(false);
    }
  }

  function updateLinkState(invoiceId: number, patch: Partial<LinkState>) {
    setLinkState((prev) => ({
      ...prev,
      [invoiceId]: {
        ...(prev[invoiceId] ?? {
          orderNo: "",
          supplierId: "",
          pending: false,
          message: null,
          error: null,
        }),
        ...patch,
      },
    }));
  }

  async function linkOrder(invoice: TaxInvoiceRow) {
    const state = linkState[invoice.id];
    if (!state?.orderNo.trim()) {
      updateLinkState(invoice.id, { error: "주문번호를 입력하세요.", message: null });
      return;
    }

    updateLinkState(invoice.id, { pending: true, error: null, message: null });
    try {
      const response = await fetch(`/api/admin/tax-invoices/${invoice.id}/link-order`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderNo: state.orderNo.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "주문 연결 실패");
      }
      updateLinkState(invoice.id, { pending: false, message: "주문 연결 완료" });
      await loadInvoices();
    } catch (err) {
      updateLinkState(invoice.id, {
        pending: false,
        error: err instanceof Error ? err.message : "주문 연결 실패",
      });
    }
  }

  async function unlinkOrder(invoice: TaxInvoiceRow) {
    updateLinkState(invoice.id, { pending: true, error: null, message: null });
    try {
      const response = await fetch(`/api/admin/tax-invoices/${invoice.id}/link-order`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "주문 연결 해제 실패");
      }
      updateLinkState(invoice.id, {
        pending: false,
        orderNo: "",
        message: "주문 연결 해제 완료",
      });
      await loadInvoices();
    } catch (err) {
      updateLinkState(invoice.id, {
        pending: false,
        error: err instanceof Error ? err.message : "주문 연결 해제 실패",
      });
    }
  }

  async function linkSupplier(invoice: TaxInvoiceRow) {
    const state = linkState[invoice.id];
    updateLinkState(invoice.id, { pending: true, error: null, message: null });
    try {
      const supplierValue = state?.supplierId ? Number(state.supplierId) : null;
      const response = await fetch(`/api/admin/tax-invoices/${invoice.id}/link-supplier`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ supplierId: supplierValue }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "공급사 연결 실패");
      }

      updateLinkState(invoice.id, {
        pending: false,
        message: supplierValue ? "공급사 연결 완료" : "미분류로 변경 완료",
      });
      await loadInvoices();
    } catch (err) {
      updateLinkState(invoice.id, {
        pending: false,
        error: err instanceof Error ? err.message : "공급사 연결 실패",
      });
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onFilterSubmit}
        className="rounded border border-[#2d333d] bg-[#1a1d23] p-4"
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">공급사</span>
            <select
              className="rounded border border-[#2d333d] px-2 py-1"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">전체</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier.supplierId} value={supplier.supplierId ?? ""}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={unclassifiedOnly}
              onChange={(e) => setUnclassifiedOnly(e.target.checked)}
            />
            미분류만 보기
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">기간(시작)</span>
            <input
              type="date"
              className="rounded border border-[#2d333d] px-2 py-1"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">기간(종료)</span>
            <input
              type="date"
              className="rounded border border-[#2d333d] px-2 py-1"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">발신메일</span>
            <input
              className="rounded border border-[#2d333d] px-2 py-1"
              placeholder="invoice@acompany.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">주문번호</span>
            <input
              className="rounded border border-[#2d333d] px-2 py-1"
              placeholder="ORD-20260312-001"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
            />
          </label>
          <button className="rounded border border-[#2d333d] px-3 py-1 text-sm" type="submit">
            필터 적용
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            onClick={runSync}
            disabled={syncPending}
          >
            {syncPending ? "동기화 중..." : "IMAP 동기화 실행"}
          </button>
        </div>
      </form>

      {syncMessage ? (
        <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{syncMessage}</p>
      ) : null}
      {error ? <p className="rounded bg-red-950/30 p-3 text-sm text-red-400">{error}</p> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {mailbox.map((box) => (
          <article key={`${box.supplierId ?? "unmatched"}`} className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
            <p className="text-xs text-gray-400">공급사 메일함</p>
            <p className="mt-1 text-sm font-semibold text-white">{box.supplierName}</p>
            <p className="mt-2 text-2xl font-bold text-white">{box.count}</p>
          </article>
        ))}
      </section>

      <section className="overflow-auto rounded border border-[#2d333d] bg-[#1a1d23] p-4">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#111318]">
              <th className="border border-[#2d333d] px-2 py-1 text-left">공급사</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">발신메일</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">수신일시</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">첨부 개수</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">첨부 존재</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">주문 연결 상태</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">연결 방식</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">미분류 여부</th>
              <th className="border border-[#2d333d] px-2 py-1 text-left">수동 연결</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state = linkState[row.id];
              return (
                <tr key={row.id}>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {row.supplier?.supplier_name ?? "미분류"}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">{row.email_inbox.from_email}</td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {new Date(row.email_inbox.received_at).toLocaleString()}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {row.email_inbox.attachment_count}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {row.files.length > 0 ? "Y" : "N(첨부 없음)"}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {row.order ? (
                      <a className="text-blue-400 underline" href={`/admin/orders/${row.order.id}`}>
                        {row.order.order_no}
                      </a>
                    ) : (
                      <span className="text-gray-400">미연결</span>
                    )}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {row.order_link_type === "AUTO"
                      ? "자동 연결"
                      : row.order_link_type === "MANUAL"
                        ? "수동 연결"
                        : "미연결"}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    {row.supplier_id ? "N" : "Y"}
                  </td>
                  <td className="border border-[#2d333d] px-2 py-1">
                    <div className="mb-1 flex flex-wrap gap-1">
                      {row.files.map((file) => (
                        <a
                          key={file.id}
                          href={`/api/admin/tax-invoices/files/${file.id}/download`}
                          className="rounded border border-[#2d333d] px-2 py-0.5 text-xs"
                        >
                          {file.file_type} 다운로드
                        </a>
                      ))}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <select
                        className="rounded border border-[#2d333d] px-2 py-1 text-xs"
                        value={state?.supplierId ?? ""}
                        onChange={(e) =>
                          updateLinkState(row.id, {
                            supplierId: e.target.value,
                            error: null,
                            message: null,
                          })
                        }
                      >
                        <option value="">미분류</option>
                        {supplierList.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.supplier_name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded border border-[#2d333d] px-2 py-1 text-xs"
                        onClick={() => linkSupplier(row)}
                        disabled={state?.pending}
                      >
                        공급사 적용
                      </button>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        className="w-40 rounded border border-[#2d333d] px-2 py-1 text-xs"
                        value={state?.orderNo ?? ""}
                        onChange={(e) =>
                          updateLinkState(row.id, {
                            orderNo: e.target.value,
                            error: null,
                            message: null,
                          })
                        }
                        placeholder="ORD-20260312-001"
                      />
                      <button
                        className="rounded border border-[#2d333d] px-2 py-1 text-xs"
                        onClick={() => linkOrder(row)}
                        disabled={state?.pending}
                      >
                        {state?.pending ? "처리 중..." : "연결"}
                      </button>
                      <button
                        className="rounded border border-[#2d333d] px-2 py-1 text-xs"
                        onClick={() => unlinkOrder(row)}
                        disabled={state?.pending || !row.order_id}
                      >
                        연결 해제
                      </button>
                    </div>
                    {state?.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
                    {state?.message ? (
                      <p className="text-xs text-emerald-700">{state.message}</p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">세금계산서 데이터가 없습니다.</p>
        ) : null}
      </section>
    </div>
  );
}
