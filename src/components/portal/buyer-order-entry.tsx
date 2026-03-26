"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  message?: string;
};

type Role = "BUYER" | "COUNTRY_ADMIN" | "SUPER_ADMIN" | "ADMIN" | "KOREA_SUPPLY_ADMIN" | "SUPPLIER";

type AuthMeResponse = {
  success: boolean;
  data?: {
    role: Role;
  } | null;
};

type LineTab = "ALL" | "CONSTRUCTION" | "GENERAL";

export function BuyerOrderEntry() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [lineTab, setLineTab] = useState<LineTab>("ALL");
  const [products, setProducts] = useState<Product[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<number, string>>({});
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [draftOrderId, setDraftOrderId] = useState<number | null>(null);
  const [draftOrderNo, setDraftOrderNo] = useState<string | null>(null);
  const [draftCreating, setDraftCreating] = useState(false);
  const [draftAdding, setDraftAdding] = useState(false);
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCountryAdmin = role === "COUNTRY_ADMIN";

  useEffect(() => {
    async function loadInitialData() {
      const [suppliersResponse, meResponse] = await Promise.all([
        fetch("/api/buyer/suppliers"),
        fetch("/api/auth/me"),
      ]);
      const [suppliersResult, meResult] = await Promise.all([
        suppliersResponse.json(),
        meResponse.json(),
      ]);

      if (suppliersResponse.ok && suppliersResult.success) {
        setSuppliers(suppliersResult.data as Supplier[]);
      }
      const me = meResult as AuthMeResponse;
      if (meResponse.ok && me.success && me.data?.role) {
        setRole(me.data.role);
      }
    }

    loadInitialData();
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
      if (lineTab !== "ALL") {
        params.set("category", lineTab);
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
  }, [supplierId, keyword, lineTab]);

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
      setError(t("error"));
      return;
    }

    if (isCountryAdmin) {
      if (!draftOrderId) {
        setError(t("error"));
        return;
      }

      setDraftAdding(true);
      try {
        const response = await fetch(`/api/buyer/orders/${draftOrderId}/items`, {
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
          throw new Error(result.message ?? t("error"));
        }

        setMessage(`초안 주문에 ${selectedItems.length}개 품목을 추가했습니다. (${draftOrderNo ?? ""})`);
        setQtyMap({});
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : t("error"));
        return;
      } finally {
        setDraftAdding(false);
      }
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
      setError(result.message ?? t("error"));
      return;
    }

    setMessage(`주문 생성 완료: ${result.data.order_no}`);
    setQtyMap({});
  }

  async function createCountryOrderDraft() {
    setError(null);
    setMessage(null);
    setDraftCreating(true);
    try {
      const response = await fetch("/api/buyer/orders/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }

      setDraftOrderId(result.data.id as number);
      setDraftOrderNo(result.data.order_no as string);
      setMessage(`국가 주문 초안을 생성했습니다: ${result.data.order_no as string}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setDraftCreating(false);
    }
  }

  async function submitCountryDraftOrder() {
    setError(null);
    setMessage(null);
    if (!draftOrderId) {
      setError(t("error"));
      return;
    }
    setDraftSubmitting(true);
    try {
      const response = await fetch(`/api/buyer/orders/${draftOrderId}/submit`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }

      const orderNo = (result.data.order_no as string) ?? draftOrderNo ?? String(draftOrderId);
      setMessage(`주문 제출 완료: ${orderNo} (Korea Supply Admin 검토 대기)`);
      setDraftOrderId(null);
      setDraftOrderNo(null);
      setQtyMap({});
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setDraftSubmitting(false);
    }
  }

  async function onExcelUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!supplierId) {
      setError(t("error"));
      return;
    }

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setError(t("error"));
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
      setError(result.message ?? t("error"));
      return;
    }
    setMessage(`엑셀 주문 생성 완료: ${result.data.order.order_no}`);
    form.reset();
  }

  return (
    <div className="space-y-4">
      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("create_order")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={supplierId ?? ""}
            onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t("supplier")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplier_name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder={t("search")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          {supplierId ? (
            <a
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              href={`/api/buyer/orders/excel-template?supplierId=${supplierId}`}
            >
              {t("download")}
            </a>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
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
              className={`rounded px-3 py-1 text-xs ${
                lineTab === tab.key ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
              }`}
              onClick={() => setLineTab(tab.key)}
              disabled={!supplierId}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {isCountryAdmin ? (
        <section className="rounded border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">{t("orders")}</h3>
          <p className="mt-1 text-sm text-slate-600">
            1) 주문 초안 생성 → 2) 품목 추가 → 3) 주문 제출(UNDER_REVIEW)
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={createCountryOrderDraft}
              disabled={draftCreating || !!draftOrderId}
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
            >
              {draftCreating ? t("loading") : t("create")}
            </button>
            <button
              type="button"
              onClick={submitCountryDraftOrder}
              disabled={draftSubmitting || !draftOrderId}
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-60"
            >
              {draftSubmitting ? t("loading") : t("submit")}
            </button>
            <span className="text-sm text-slate-700">
              {t("status")}: {draftOrderNo ?? "-"}
            </span>
          </div>
        </section>
      ) : null}

      <section className="rounded border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">{t("products")}</h3>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-1 text-left">Code</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("product")}</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Description</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Spec</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Unit</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Price</th>
                <th className="border border-slate-200 px-2 py-1 text-left">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="border border-slate-200 px-2 py-1">{product.product_code}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.product_name}</td>
                  <td className="border border-slate-200 px-2 py-1">{product.description ?? "-"}</td>
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
          <p className="text-sm text-slate-600">{t("product_count")}: {selectedItems.length}</p>
          <button
            type="button"
            onClick={submitOrder}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            disabled={draftAdding}
          >
            {isCountryAdmin
              ? draftAdding
                ? t("loading")
                : t("apply")
              : t("submit")}
          </button>
        </div>
      </section>

      {!isCountryAdmin ? (
        <section className="rounded border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">{t("orders")} Excel</h3>
          <form className="mt-3 flex items-center gap-2" onSubmit={onExcelUpload}>
            <input name="file" type="file" accept=".xlsx,.xls" />
            <button className="rounded border border-slate-300 px-3 py-1 text-sm" type="submit">
              {t("upload")}
            </button>
          </form>
        </section>
      ) : null}

      {message ? <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
