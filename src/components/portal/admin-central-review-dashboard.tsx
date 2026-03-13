"use client";

import { useEffect, useState } from "react";

type SupplierOption = {
  id: number;
  supplier_name: string;
  is_active: boolean;
};

type ReviewOrder = {
  id: number;
  order_no: string;
  status: "UNDER_REVIEW";
  created_at: string;
  buyer: {
    id: number;
    name: string;
    role: "COUNTRY_ADMIN" | "BUYER";
  };
  country: {
    id: number;
    country_code: string;
    country_name: string;
  };
  order_items: Array<{
    id: number;
    supplier_id: number;
    status: string;
    product_code_snapshot: string;
    product_name_snapshot: string;
    spec_snapshot: string;
    unit_snapshot: string;
    qty: string;
    supplier: {
      id: number;
      supplier_name: string;
    };
  }>;
};

export function AdminCentralReviewDashboard() {
  const [orders, setOrders] = useState<ReviewOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [selectedSupplierMap, setSelectedSupplierMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [assigningItemId, setAssigningItemId] = useState<number | null>(null);
  const statusChangeDisabled = true;

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [ordersResponse, suppliersResponse] = await Promise.all([
        fetch("/api/admin/orders/central-review"),
        fetch("/api/admin/suppliers"),
      ]);
      const [ordersResult, suppliersResult] = await Promise.all([
        ordersResponse.json(),
        suppliersResponse.json(),
      ]);

      if (!ordersResponse.ok || !ordersResult.success) {
        throw new Error(ordersResult.message ?? "중앙 검토 주문 조회 실패");
      }
      if (!suppliersResponse.ok || !suppliersResult.success) {
        throw new Error(suppliersResult.message ?? "공급사 목록 조회 실패");
      }

      const orderRows = ordersResult.data as ReviewOrder[];
      const supplierRows = (suppliersResult.data as SupplierOption[]).filter((row) => row.is_active);
      setOrders(orderRows);
      setSuppliers(supplierRows);
      setSelectedSupplierMap(
        orderRows
          .flatMap((order) => order.order_items)
          .reduce<Record<number, number>>((acc, item) => {
            acc[item.id] = item.supplier_id;
            return acc;
          }, {}),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "중앙 검토 주문 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function assignSupplier(orderId: number, orderItemId: number) {
    const supplierId = selectedSupplierMap[orderItemId];
    if (!supplierId) {
      setError("배정할 공급사를 선택해 주세요.");
      return;
    }

    setError(null);
    setMessage(null);
    setAssigningItemId(orderItemId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/assignment/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId, supplierId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "공급사 배정 실패");
      }

      setMessage("품목 공급사 배정이 완료되었습니다. 공급사에 알림이 발송되었습니다.");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "공급사 배정 실패");
    } finally {
      setAssigningItemId(null);
    }
  }

  return (
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">중앙 검토 큐</h2>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-sm"
          onClick={loadDashboard}
        >
          새로고침
        </button>
      </div>
      <p className="text-sm text-slate-600">
        COUNTRY_ADMIN 검토를 거쳐 UNDER_REVIEW 상태인 주문을 조회합니다.
      </p>
      <p className="text-xs text-amber-700">
        정책 변경으로 관리자 계정은 상태 변경/공급사 배정을 수행할 수 없습니다.
      </p>

      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">중앙 검토 주문을 불러오는 중...</p> : null}

      {!loading && orders.length === 0 ? (
        <p className="rounded border border-slate-200 p-3 text-sm text-slate-500">
          검토 대기 주문이 없습니다.
        </p>
      ) : null}

      {!loading
        ? orders.map((order) => (
            <article key={order.id} className="rounded border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{order.order_no}</p>
                  <p className="text-xs text-slate-500">
                    국가: {order.country.country_name} ({order.country.country_code}) / 생성자:{" "}
                    {order.buyer.name} / 생성일: {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <a
                  href={`/admin/orders/${order.id}`}
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                >
                  주문 보기
                </a>
              </div>

              <div className="mt-3 overflow-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-200 px-2 py-1 text-left">코드</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">상품명</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">수량</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">현재 공급사</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">공급사 배정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items.map((item) => (
                      <tr key={item.id}>
                        <td className="border border-slate-200 px-2 py-1">{item.product_code_snapshot}</td>
                        <td className="border border-slate-200 px-2 py-1">{item.product_name_snapshot}</td>
                        <td className="border border-slate-200 px-2 py-1">{item.spec_snapshot}</td>
                        <td className="border border-slate-200 px-2 py-1">
                          {item.qty} {item.unit_snapshot}
                        </td>
                        <td className="border border-slate-200 px-2 py-1">{item.supplier.supplier_name}</td>
                        <td className="border border-slate-200 px-2 py-1">
                          <div className="flex items-center gap-2">
                            <select
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                              value={selectedSupplierMap[item.id] ?? item.supplier_id}
                              disabled={statusChangeDisabled}
                              onChange={(event) =>
                                setSelectedSupplierMap((prev) => ({
                                  ...prev,
                                  [item.id]: Number(event.target.value),
                                }))
                              }
                            >
                              {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.supplier_name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                              disabled={statusChangeDisabled || assigningItemId === item.id}
                              onClick={() => assignSupplier(order.id, item.id)}
                            >
                              {assigningItemId === item.id ? "배정 중..." : "배정"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))
        : null}
    </section>
  );
}
