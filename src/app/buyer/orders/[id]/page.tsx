"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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
    supplier: {
      id: number;
      supplier_name: string;
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
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const [detail, setDetail] = useState<BuyerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/buyer/orders/${orderId}`);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "주문 상세 조회 실패");
        }
        setDetail(result.data as BuyerOrderDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "주문 상세 조회 실패");
      } finally {
        setLoading(false);
      }
    }

    if (!Number.isNaN(orderId)) {
      load();
    }
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

  if (loading) {
    return <p className="text-sm text-slate-500">주문 상세를 불러오는 중...</p>;
  }
  if (error || !detail) {
    return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error ?? "주문 없음"}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{detail.order_no}</h1>
        <Link
          href="/buyer/orders"
          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700"
        >
          목록으로
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        상태: {detail.status} / 결제 상태: {detail.buyer_status} / 바이어: {detail.buyer.name} / 국가:{" "}
        {detail.country.country_name} ({detail.country.country_code})
      </p>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Order Summary</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
          <div className="rounded bg-slate-50 p-2">
            <p className="text-xs text-slate-500">주문번호</p>
            <p className="font-semibold text-slate-900">{detail.order_no}</p>
          </div>
          <div className="rounded bg-slate-50 p-2">
            <p className="text-xs text-slate-500">주문일</p>
            <p className="font-semibold text-slate-900">{new Date(detail.created_at).toLocaleString()}</p>
          </div>
          <div className="rounded bg-slate-50 p-2">
            <p className="text-xs text-slate-500">주문 상태</p>
            <p className="font-semibold text-slate-900">{detail.status}</p>
          </div>
          <div className="rounded bg-slate-50 p-2">
            <p className="text-xs text-slate-500">결제 상태</p>
            <p className="font-semibold text-slate-900">{detail.buyer_status}</p>
          </div>
        </div>

        <h3 className="mt-4 text-sm font-semibold text-slate-900">주문 품목</h3>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">상품코드</th>
                <th className="border border-slate-200 px-2 py-1 text-left">제품명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">수량</th>
              </tr>
            </thead>
            <tbody>
              {detail.order_items.map((item) => (
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
        <h2 className="text-lg font-semibold">Supplier Shipments</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Shipment 번호</th>
                <th className="border border-slate-200 px-2 py-1 text-left">배송 상태</th>
                <th className="border border-slate-200 px-2 py-1 text-left">공급사 상태</th>
              </tr>
            </thead>
            <tbody>
              {detail.suppliers.flatMap((supplierRow) =>
                supplierRow.shipments.map((shipment) => (
                  <tr key={shipment.id}>
                    <td className="border border-slate-200 px-2 py-1">
                      {supplierRow.supplier.supplier_name}
                    </td>
                    <td className="border border-slate-200 px-2 py-1">{shipment.shipment_no}</td>
                    <td className="border border-slate-200 px-2 py-1">{shipment.status}</td>
                    <td className="border border-slate-200 px-2 py-1">{shipment.supplier_status}</td>
                  </tr>
                )),
              )}
              {detail.suppliers.every((supplierRow) => supplierRow.shipments.length === 0) ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-3 text-center text-slate-500" colSpan={4}>
                    등록된 Shipment가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Shipment Status Timeline</h2>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">배송 상태 로그가 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {timeline.map((row) => (
              <li key={row.id} className="rounded bg-slate-50 px-2 py-1 text-slate-700">
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
