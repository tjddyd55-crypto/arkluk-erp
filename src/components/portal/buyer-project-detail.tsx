"use client";

import { useEffect, useState } from "react";

type BuyerProjectDetailPayload = {
  project: {
    id: number;
    project_name: string;
    status: "DRAFT" | "QUOTING" | "QUOTED" | "ORDERING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
    memo: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    country: { country_name: string };
  };
  files: Array<{
    id: number;
    original_name: string;
    file_type: "PDF" | "DWG" | "ZIP" | "PNG" | "JPG" | "JPEG";
    file_size: number;
    created_at: string;
  }>;
  orders: Array<{
    id: number;
    order_no: string;
    status: string;
    created_at: string;
    supplier_count: number;
  }>;
  summary: {
    order_supplier_status_count: Record<string, number>;
    order_suppliers: Array<{
      id: number;
      status: string;
      expected_delivery_date: string | null;
      supplier: { supplier_name: string };
      order: { order_no: string };
    }>;
    tax_invoices: Array<{
      id: number;
      attachment_count: number;
      received_at: string;
      supplier: { supplier_name: string } | null;
      order: { order_no: string } | null;
      files: Array<{ id: number; file_type: "PDF" | "XML"; file_name: string }>;
    }>;
  };
};

type QuoteRow = {
  id: number;
  quote_no: string;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED";
  created_at: string;
  total_amount: string;
  item_count: number;
  quote_items: Array<{
    id: number;
    supplier: { supplier_name: string };
    product_name_snapshot: string;
    spec_snapshot: string;
    unit_snapshot: string;
    qty: string;
    price_snapshot: string;
    amount: string;
  }>;
};

const projectStatusLabel: Record<
  BuyerProjectDetailPayload["project"]["status"],
  string
> = {
  DRAFT: "초안",
  QUOTING: "견적 작성중",
  QUOTED: "견적 발송",
  ORDERING: "주문 진행",
  ACTIVE: "발주 진행",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

export function BuyerProjectDetail({ projectId }: { projectId: number }) {
  const [detail, setDetail] = useState<BuyerProjectDetailPayload | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actingQuoteId, setActingQuoteId] = useState<number | null>(null);

  async function loadDetail() {
    const [detailResponse, quotesResponse] = await Promise.all([
      fetch(`/api/buyer/projects/${projectId}`),
      fetch(`/api/buyer/projects/${projectId}/quotes`),
    ]);
    const detailResult = await detailResponse.json();
    const quotesResult = await quotesResponse.json();
    if (!detailResponse.ok || !detailResult.success) {
      throw new Error(detailResult.message ?? "프로젝트 상세 조회 실패");
    }
    if (!quotesResponse.ok || !quotesResult.success) {
      throw new Error(quotesResult.message ?? "프로젝트 견적 조회 실패");
    }
    setDetail(detailResult.data as BuyerProjectDetailPayload);
    setQuotes(quotesResult.data as QuoteRow[]);
  }

  async function reload() {
    setLoading(true);
    setActionError(null);
    try {
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function actQuote(quoteId: number, action: "accept" | "reject") {
    setActionError(null);
    setActionMessage(null);
    setActingQuoteId(quoteId);
    try {
      const response = await fetch(
        `/api/buyer/projects/${projectId}/quotes/${quoteId}/${action}`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? `견적 ${action} 실패`);
      }
      setActionMessage(
        action === "accept"
          ? "견적을 승인했고 프로젝트 주문이 생성되었습니다."
          : "견적을 거절했습니다.",
      );
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `견적 ${action} 실패`);
    } finally {
      setActingQuoteId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">프로젝트 상세를 불러오는 중...</p>;
  }
  if (!detail) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">프로젝트를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <header className="rounded border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">{detail.project.project_name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          국가: {detail.project.country.country_name} / 상태:{" "}
          {projectStatusLabel[detail.project.status]}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          위치: {detail.project.location ?? "-"} / 시작:{" "}
          {detail.project.start_date ? new Date(detail.project.start_date).toLocaleDateString() : "-"} / 종료:{" "}
          {detail.project.end_date ? new Date(detail.project.end_date).toLocaleDateString() : "-"}
        </p>
      </header>

      {actionMessage ? (
        <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{actionMessage}</p>
      ) : null}
      {actionError ? (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{actionError}</p>
      ) : null}

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">첨부파일</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">파일명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">형식</th>
                <th className="border border-slate-200 px-2 py-1 text-left">크기</th>
                <th className="border border-slate-200 px-2 py-1 text-left">다운로드</th>
              </tr>
            </thead>
            <tbody>
              {detail.files.map((file) => (
                <tr key={file.id}>
                  <td className="border border-slate-200 px-2 py-1">{file.original_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{file.file_type}</td>
                  <td className="border border-slate-200 px-2 py-1">{(file.file_size / 1024).toFixed(1)} KB</td>
                  <td className="border border-slate-200 px-2 py-1">
                    <a
                      className="text-blue-700 underline"
                      href={`/api/buyer/projects/files/${file.id}/download`}
                    >
                      다운로드
                    </a>
                  </td>
                </tr>
              ))}
              {detail.files.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-slate-200 px-2 py-3 text-center text-slate-500">
                    첨부파일이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">프로젝트 견적</h2>
        <div className="mt-3 space-y-3">
          {quotes.map((quote) => (
            <article key={quote.id} className="rounded border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {quote.quote_no} / 상태: {quote.status} / 총액:{" "}
                  {Number(quote.total_amount).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-60"
                    disabled={
                      actingQuoteId === quote.id ||
                      !["SENT", "VIEWED"].includes(quote.status)
                    }
                    onClick={() => actQuote(quote.id, "accept")}
                  >
                    {actingQuoteId === quote.id ? "처리 중..." : "견적 승인"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-60"
                    disabled={
                      actingQuoteId === quote.id ||
                      !["SENT", "VIEWED"].includes(quote.status)
                    }
                    onClick={() => actQuote(quote.id, "reject")}
                  >
                    견적 거절
                  </button>
                </div>
              </div>

              <div className="mt-2 overflow-auto">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">제품명</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">단위</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">수량</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">단가</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.quote_items.map((item) => (
                      <tr key={item.id}>
                        <td className="border border-slate-200 px-2 py-1">{item.supplier.supplier_name}</td>
                        <td className="border border-slate-200 px-2 py-1">{item.product_name_snapshot}</td>
                        <td className="border border-slate-200 px-2 py-1">{item.spec_snapshot}</td>
                        <td className="border border-slate-200 px-2 py-1">{item.unit_snapshot}</td>
                        <td className="border border-slate-200 px-2 py-1">{item.qty}</td>
                        <td className="border border-slate-200 px-2 py-1">{item.price_snapshot}</td>
                        <td className="border border-slate-200 px-2 py-1">{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
          {quotes.length === 0 ? (
            <p className="text-sm text-slate-500">등록된 프로젝트 견적이 없습니다.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">프로젝트 주문</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">공급사 수</th>
                <th className="border border-slate-200 px-2 py-1 text-left">생성일</th>
              </tr>
            </thead>
            <tbody>
              {detail.orders.map((order) => (
                <tr key={order.id}>
                  <td className="border border-slate-200 px-2 py-1">{order.order_no}</td>
                  <td className="border border-slate-200 px-2 py-1">{order.status}</td>
                  <td className="border border-slate-200 px-2 py-1">{order.supplier_count}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(order.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {detail.orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-slate-200 px-2 py-3 text-center text-slate-500">
                    생성된 주문이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">발주 / 세금계산서 요약</h2>
        <p className="mt-2 text-sm text-slate-700">
          발주 상태 집계:{" "}
          {Object.entries(detail.summary.order_supplier_status_count)
            .map(([key, value]) => `${key}:${value}`)
            .join(", ") || "집계 없음"}
        </p>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">납기예정</th>
              </tr>
            </thead>
            <tbody>
              {detail.summary.order_suppliers.map((row) => (
                <tr key={row.id}>
                  <td className="border border-slate-200 px-2 py-1">{row.order.order_no}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.supplier.supplier_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{row.status}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {row.expected_delivery_date
                      ? new Date(row.expected_delivery_date).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">주문번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                <th className="border border-slate-200 px-2 py-1 text-left">수신일</th>
                <th className="border border-slate-200 px-2 py-1 text-left">첨부 수</th>
                <th className="border border-slate-200 px-2 py-1 text-left">첨부 다운로드</th>
              </tr>
            </thead>
            <tbody>
              {detail.summary.tax_invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="border border-slate-200 px-2 py-1">
                    {invoice.order?.order_no ?? "-"}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {invoice.supplier?.supplier_name ?? "미분류"}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {new Date(invoice.received_at).toLocaleString()}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">{invoice.attachment_count}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {invoice.files.map((file) => (
                        <a
                          key={file.id}
                          className="text-blue-700 underline"
                          href={`/api/buyer/tax-invoices/files/${file.id}/download`}
                        >
                          {file.file_type}
                        </a>
                      ))}
                      {invoice.files.length === 0 ? (
                        <span className="text-slate-400">없음</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {detail.summary.tax_invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-slate-200 px-2 py-3 text-center text-slate-500">
                    연결된 세금계산서가 없습니다.
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
