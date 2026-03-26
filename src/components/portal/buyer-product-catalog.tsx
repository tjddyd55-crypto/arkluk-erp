"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

type Supplier = {
  id: number;
  supplier_name: string;
};

type Product = {
  id: number;
  product_code: string;
  product_name: string;
  description: string | null;
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

type LineTab = "ALL" | "CONSTRUCTION" | "GENERAL";

export function BuyerProductCatalog() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [lineTab, setLineTab] = useState<LineTab>("ALL");
  const [keyword, setKeyword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSuppliers() {
      const response = await fetch("/api/buyer/suppliers");
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message ?? t("error"));
        return;
      }
      setSuppliers(result.data as Supplier[]);
    }

    loadSuppliers();
  }, [t]);

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
  }, [supplierId, keyword, lineTab]);

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[240px_1fr]">
        <label className="text-sm text-slate-600">
          {t("supplier")}
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
            value={supplierId ?? ""}
            onChange={(event) =>
              setSupplierId(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">{t("confirm")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplier_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          {t("search")}
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={t("search")}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "ALL" as const, label: "전체" },
            { key: "CONSTRUCTION" as const, label: "건축자재" },
            { key: "GENERAL" as const, label: "기타상품" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`rounded px-3 py-1 text-sm ${
              lineTab === tab.key ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => setLineTab(tab.key)}
            disabled={!supplierId}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-200 px-2 py-1 text-left">Code</th>
              <th className="border border-slate-200 px-2 py-1 text-left">{t("product")}</th>
              <th className="border border-slate-200 px-2 py-1 text-left">Description</th>
              <th className="border border-slate-200 px-2 py-1 text-left">Spec</th>
              <th className="border border-slate-200 px-2 py-1 text-left">Unit</th>
              <th className="border border-slate-200 px-2 py-1 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="border border-slate-200 px-2 py-6 text-center text-slate-500"
                >
                  {t("no_data")}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td className="border border-slate-200 px-2 py-1">{product.product_code}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.product_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.description ?? "-"}</td>
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
