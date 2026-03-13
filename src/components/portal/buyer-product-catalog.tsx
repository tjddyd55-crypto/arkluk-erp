"use client";

import { useEffect, useState } from "react";

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
};

export function BuyerProductCatalog() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSuppliers() {
      const response = await fetch("/api/buyer/suppliers");
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message ?? "공급사 목록 조회 실패");
        return;
      }
      setSuppliers(result.data as Supplier[]);
    }

    loadSuppliers();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      if (!supplierId) {
        setProducts([]);
        return;
      }
      const params = new URLSearchParams({ supplierId: String(supplierId) });
      if (keyword.trim()) {
        params.set("keyword", keyword.trim());
      }
      const response = await fetch(`/api/buyer/catalog?${params.toString()}`);
      const result = (await response.json()) as CatalogResponse;
      if (!response.ok || !result.success || !result.data) {
        setProducts([]);
        return;
      }
      setProducts(result.data.products);
    }

    loadProducts();
  }, [supplierId, keyword]);

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[240px_1fr]">
        <label className="text-sm text-slate-600">
          공급사
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
            value={supplierId ?? ""}
            onChange={(event) =>
              setSupplierId(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">선택</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplier_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          검색 (상품코드/상품명/규격)
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="예: PVC, PIPE-100"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-200 px-2 py-1 text-left">코드</th>
              <th className="border border-slate-200 px-2 py-1 text-left">상품명</th>
              <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
              <th className="border border-slate-200 px-2 py-1 text-left">단위</th>
              <th className="border border-slate-200 px-2 py-1 text-right">단가</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="border border-slate-200 px-2 py-6 text-center text-slate-500"
                >
                  조회된 상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td className="border border-slate-200 px-2 py-1">{product.product_code}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.product_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.spec}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.unit}</td>
                  <td className="border border-slate-200 px-2 py-1 text-right">{product.price}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
