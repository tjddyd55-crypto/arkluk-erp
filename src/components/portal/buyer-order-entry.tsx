"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Supplier = {
  id: number;
  supplier_name: string;
};

type Product = {
  id: number;
  product_code: string;
  product_name: string;
  spec: string;
  unit: string;
  price: string;
};

type CatalogResponse = {
  success: boolean;
  data?: {
    products: Product[];
  };
  message?: string;
};

export function BuyerOrderEntry() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<number, string>>({});
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSuppliers() {
      const response = await fetch("/api/buyer/suppliers");
      const result = await response.json();
      if (response.ok && result.success) {
        setSuppliers(result.data as Supplier[]);
      }
    }
    loadSuppliers();
  }, []);

  useEffect(() => {
    async function loadCatalog() {
      if (!supplierId) {
        setProducts([]);
        return;
      }
      const params = new URLSearchParams({
        supplierId: String(supplierId),
      });
      if (keyword.trim()) {
        params.set("keyword", keyword.trim());
      }

      const response = await fetch(`/api/buyer/catalog?${params.toString()}`);
      const result = (await response.json()) as CatalogResponse;
      if (response.ok && result.success && result.data) {
        setProducts(result.data.products);
      } else {
        setProducts([]);
      }
    }
    loadCatalog();
  }, [supplierId, keyword]);

  const selectedItems = useMemo(() => {
    return products
      .map((product) => ({
        productId: product.id,
        qty: Number(qtyMap[product.id] ?? 0),
      }))
      .filter((item) => item.qty > 0);
  }, [products, qtyMap]);

  async function submitOrder() {
    setError(null);
    setMessage(null);

    if (!selectedItems.length) {
      setError("수량이 0보다 큰 상품을 최소 1개 선택하세요.");
      return;
    }

    const response = await fetch("/api/buyer/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: selectedItems,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(result.message ?? "주문 생성 실패");
      return;
    }

    setMessage(`주문 생성 완료: ${result.data.order_no}`);
    setQtyMap({});
  }

  async function onExcelUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!supplierId) {
      setError("공급사를 먼저 선택하세요.");
      return;
    }

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setError("엑셀 파일을 선택하세요.");
      return;
    }

    const data = new FormData();
    data.append("file", file);
    data.append("supplierId", String(supplierId));
    data.append("commit", "true");

    const response = await fetch("/api/buyer/orders/excel-upload", {
      method: "POST",
      body: data,
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(result.message ?? "엑셀 주문 실패");
      return;
    }
    setMessage(`엑셀 주문 생성 완료: ${result.data.order.order_no}`);
    form.reset();
  }

  return (
    <div className="space-y-4">
      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">회사 선택 주문</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={supplierId ?? ""}
            onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">공급사 선택</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplier_name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="상품코드/상품명/규격 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          {supplierId ? (
            <a
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              href={`/api/buyer/orders/excel-template?supplierId=${supplierId}`}
            >
              엑셀 템플릿 다운로드
            </a>
          ) : null}
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">상품 목록</h3>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">코드</th>
                <th className="border border-slate-200 px-2 py-1 text-left">상품명</th>
                <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
                <th className="border border-slate-200 px-2 py-1 text-left">단위</th>
                <th className="border border-slate-200 px-2 py-1 text-left">단가</th>
                <th className="border border-slate-200 px-2 py-1 text-left">수량</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="border border-slate-200 px-2 py-1">{product.product_code}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.product_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.spec}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.unit}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    {Number(product.price).toLocaleString()}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <input
                      value={qtyMap[product.id] ?? ""}
                      onChange={(e) =>
                        setQtyMap((prev) => ({ ...prev, [product.id]: e.target.value }))
                      }
                      className="w-24 rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-slate-600">선택 상품 수: {selectedItems.length}</p>
          <button
            type="button"
            onClick={submitOrder}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
          >
            주문 제출
          </button>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">공급사 엑셀 주문 업로드</h3>
        <form className="mt-3 flex items-center gap-2" onSubmit={onExcelUpload}>
          <input name="file" type="file" accept=".xlsx,.xls" />
          <button className="rounded border border-slate-300 px-3 py-1 text-sm" type="submit">
            엑셀 업로드 주문 생성
          </button>
        </form>
      </section>

      {message ? <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
