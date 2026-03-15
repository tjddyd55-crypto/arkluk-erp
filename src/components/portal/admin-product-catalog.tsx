"use client";

import { useEffect, useMemo, useState } from "react";

type ProductRow = {
  id: number;
  name_original: string;
  description_original: string | null;
  source_language: "ko" | "en" | "mn" | "ar";
  specification: string | null;
  spec: string;
  price: string;
  currency: string;
  supplier: {
    supplier_name: string;
    company_name: string | null;
  };
  category: {
    category_name: string;
  };
  product_name: string;
  description: string | null;
  memo: string | null;
};

const LANGUAGE_LABEL: Record<ProductRow["source_language"], string> = {
  ko: "한국어",
  en: "English",
  mn: "Монгол",
  ar: "العربية",
};

export function AdminProductCatalog() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/products");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "상품 목록 조회 실패");
      }
      setRows((result.data ?? []) as ProductRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const supplierOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.supplier.company_name ?? row.supplier.supplier_name).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      const supplierName = row.supplier.company_name ?? row.supplier.supplier_name;
      const productName = row.name_original || row.product_name;
      const passSupplier = supplierFilter === "all" || supplierName === supplierFilter;
      if (!keyword) {
        return passSupplier;
      }
      return (
        passSupplier &&
        (productName.toLowerCase().includes(keyword) || supplierName.toLowerCase().includes(keyword))
      );
    });
  }, [rows, search, supplierFilter]);

  const groupedRows = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          const supplierName = row.supplier.company_name ?? row.supplier.supplier_name;
          if (!acc[supplierName]) {
            acc[supplierName] = [];
          }
          acc[supplierName].push(row);
          return acc;
        },
        {} as Record<string, ProductRow[]>,
      ),
    [filteredRows],
  );

  return (
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">전체 상품 조회</h2>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-sm"
          onClick={loadProducts}
        >
          새로고침
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-50 p-2">
        <select
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          value={supplierFilter}
          onChange={(event) => setSupplierFilter(event.target.value)}
        >
          <option value="all">전체 공급사</option>
          {supplierOptions.map((supplierName) => (
            <option key={supplierName} value={supplierName}>
              {supplierName}
            </option>
          ))}
        </select>
        <input
          className="w-80 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="상품명 또는 공급사명 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading ? <p className="text-sm text-slate-500">상품 목록을 불러오는 중...</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      {!loading && !error ? (
        <>
          {Object.entries(groupedRows).map(([supplierName, group]) => (
            <div key={supplierName} className="mb-4 overflow-auto rounded border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
                {supplierName}
              </div>
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-2 py-1 text-left">공급사</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">카테고리</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">상품명</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">규격</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">가격</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">등록 언어</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">상품 설명</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((row) => {
                    const productName = row.name_original || row.product_name || "-";
                    const productDescription =
                      row.description_original ?? row.description ?? row.memo ?? "-";
                    return (
                      <tr key={row.id}>
                        <td className="border border-slate-200 px-2 py-1">{supplierName}</td>
                        <td className="border border-slate-200 px-2 py-1">{row.category.category_name}</td>
                        <td className="border border-slate-200 px-2 py-1">{productName}</td>
                        <td className="border border-slate-200 px-2 py-1">
                          {row.specification ?? row.spec ?? "-"}
                        </td>
                        <td className="border border-slate-200 px-2 py-1">
                          {Number(row.price).toLocaleString()} {row.currency}
                        </td>
                        <td className="border border-slate-200 px-2 py-1">
                          {LANGUAGE_LABEL[row.source_language]}
                        </td>
                        <td className="border border-slate-200 px-2 py-1">{productDescription}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-slate-500">조건에 맞는 상품이 없습니다.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
