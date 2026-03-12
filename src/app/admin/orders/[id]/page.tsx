"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type OrderDetail = {
  id: number;
  order_no: string;
  status: string;
  buyer: { name: string };
  country: { country_name: string };
  order_items: Array<{
    id: number;
    supplier_id: number;
    product_code_snapshot: string;
    product_name_snapshot: string;
    qty: string;
    unit_snapshot: string;
  }>;
  tax_invoices: Array<{
    id: number;
    order_link_type: "AUTO" | "MANUAL" | null;
    supplier: { supplier_name: string } | null;
    email_inbox: { from_email: string; received_at: string };
    files: Array<{ id: number; file_type: "PDF" | "XML"; file_name: string }>;
  }>;
};

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/orders/${orderId}`);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "주문 상세 조회 실패");
        }
        setOrder(result.data as OrderDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "주문 상세 조회 실패");
      } finally {
        setLoading(false);
      }
    }
    if (!Number.isNaN(orderId)) {
      run();
    }
  }, [orderId]);

  if (loading) {
    return <p className="text-sm text-slate-500">주문 상세를 불러오는 중...</p>;
  }

  if (error || !order) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error ?? "주문 없음"}</p>;
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
    const key = invoice.supplier?.supplier_name ?? "미분류";
    acc[key] = acc[key] ?? [];
    acc[key].push(invoice);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <header className="rounded border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">{order.order_no}</h1>
        <p className="mt-1 text-sm text-slate-600">
          바이어: {order.buyer.name} / 국가: {order.country.country_name} / 상태: {order.status}
        </p>
      </header>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">주문 품목</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">상품코드</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상품명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">수량</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-200 px-2 py-1">{item.product_code_snapshot}</td>
                  <td className="border border-slate-200 px-2 py-1">{item.product_name_snapshot}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {item.qty} {item.unit_snapshot}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">세금계산서</h2>
        <p className="mt-1 text-xs text-slate-500">
          주문 연결 해제/재연결은 세금계산서 메일함 화면에서 수행합니다.
        </p>
        {order.tax_invoices.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">연결된 세금계산서가 없습니다.</p>
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
                          ? "자동 연결"
                          : invoice.order_link_type === "MANUAL"
                            ? "수동 연결"
                            : "연결 타입 없음"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {invoice.files.length === 0 ? (
                          <span className="text-xs text-slate-400">첨부 없음</span>
                        ) : (
                          invoice.files.map((file) => (
                            <a
                              key={file.id}
                              href={`/api/admin/tax-invoices/files/${file.id}/download`}
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              {file.file_type} 다운로드
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
