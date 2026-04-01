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
    id: number;
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
      setRows(Array.isArray(result.data) ? (result.data as ProductRow[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const supplierOptions = useMemo(() => {
    const bySupplierId = new Map<number, { id: number; name: string }>();
    for (const row of rows) {
      if (!row?.supplier) {
        continue;
      }
      const supplierName = row.supplier.company_name ?? row.supplier.supplier_name;
      bySupplierId.set(row.supplier.id, { id: row.supplier.id, name: supplierName });
    }
    return Array.from(bySupplierId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      const supplierName = row.supplier.company_name ?? row.supplier.supplier_name;
      const productName = row.name_original || row.product_name;
      const passSupplier = supplierFilter === "all" || String(row.supplier.id) === supplierFilter;
      if (!keyword) {
        return passSupplier;
      }
      return (
        passSupplier &&
        (productName.toLowerCase().includes(keyword) || supplierName.toLowerCase().includes(keyword))
      );
    });
  }, [rows, search, supplierFilter]);

  const groupedRows = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const supplierId = String(row.supplier.id);
        const supplierName = row.supplier.company_name ?? row.supplier.supplier_name;
        if (!acc[supplierId]) {
          acc[supplierId] = { supplierName, rows: [] };
        }
        acc[supplierId].rows.push(row);
        return acc;
      },
      {} as Record<string, { supplierName: string; rows: ProductRow[] }>,
    );
  }, [filteredRows]);

  return (
    <section className="space-y-3 rounded border border-[#2d333d] bg-[#1a1d23] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">전체 상품 조회</h2>
        <button
          type="button"
          className="rounded border border-[#2d333d] px-3 py-1 text-sm"
          onClick={loadProducts}
        >
          새로고침
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded border border-[#2d333d] bg-[#111318] p-2">
        <select
          className="rounded border border-[#2d333d] px-2 py-1 text-sm"
          value={supplierFilter}
          onChange={(event) => setSupplierFilter(event.target.value)}
        >
          <option value="all">전체 공급사</option>
          {supplierOptions.map((supplier) => (
            <option key={supplier.id} value={String(supplier.id)}>
              {supplier.name}
            </option>
          ))}
        </select>
        <input
          className="w-80 rounded border border-[#2d333d] px-2 py-1 text-sm"
          placeholder="상품명 또는 공급사명 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading ? <p className="text-sm text-gray-400">상품 목록을 불러오는 중...</p> : null}
      {error ? <p className="rounded bg-red-950/30 p-2 text-sm text-red-400">{error}</p> : null}

      {!loading && !error ? (
        <>
          {Object.entries(groupedRows).map(([supplierId, groupData]) => (
            <div key={supplierId} className="mb-4 overflow-auto rounded border border-[#2d333d]">
              <div className="border-b border-[#2d333d] bg-[#111318] px-3 py-2 text-sm font-semibold text-white">
                {groupData.supplierName}
              </div>
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#111318]">
                    <th className="border border-[#2d333d] px-2 py-1 text-left">공급사</th>
                    <th className="border border-[#2d333d] px-2 py-1 text-left">카테고리</th>
                    <th className="border border-[#2d333d] px-2 py-1 text-left">상품명</th>
                    <th className="border border-[#2d333d] px-2 py-1 text-left">규격</th>
                    <th className="border border-[#2d333d] px-2 py-1 text-left">가격</th>
                    <th className="border border-[#2d333d] px-2 py-1 text-left">등록 언어</th>
                    <th className="border border-[#2d333d] px-2 py-1 text-left">상품 설명</th>
                  </tr>
                </thead>
                <tbody>
                  {groupData.rows.map((row) => {
                    const productName = row.name_original || row.product_name || "-";
                    const productDescription =
                      row.description_original ?? row.description ?? row.memo ?? "-";
                    return (
                      <tr key={row.id}>
                        <td className="border border-[#2d333d] px-2 py-1">{groupData.supplierName}</td>
                        <td className="border border-[#2d333d] px-2 py-1">{row.category.category_name}</td>
                        <td className="border border-[#2d333d] px-2 py-1">{productName}</td>
                        <td className="border border-[#2d333d] px-2 py-1">
                          {row.specification ?? row.spec ?? "-"}
                        </td>
                        <td className="border border-[#2d333d] px-2 py-1">
                          {Number(row.price).toLocaleString()} {row.currency}
                        </td>
                        <td className="border border-[#2d333d] px-2 py-1">
                          {LANGUAGE_LABEL[row.source_language]}
                        </td>
                        <td className="border border-[#2d333d] px-2 py-1">{productDescription}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-gray-400">조건에 맞는 상품이 없습니다.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
