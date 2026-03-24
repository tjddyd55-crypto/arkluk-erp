"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/hooks/useTranslation";

type SupplierRow = {
  id: number;
  supplier_name: string;
  company_name: string | null;
};

type ProductRow = {
  id: number;
  displayName: string;
  unitPrice: number | null;
  image_url: string | null;
  detailRows: Array<{ field_key: string; field_label: string; value: string }>;
};

type ProductsPayload = {
  form: { id: number; name: string };
  products: ProductRow[];
};

export function BuyerShopOrder() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [payload, setPayload] = useState<ProductsPayload | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supplierLabel = useMemo(() => {
    if (supplierId === "") return "";
    const s = suppliers.find((x) => x.id === supplierId);
    return s ? (s.company_name ?? s.supplier_name) : "";
  }, [supplierId, suppliers]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/buyer/suppliers");
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message ?? t("error"));
        }
        if (!cancelled) {
          const rows = (result.data as SupplierRow[]) ?? [];
          setSuppliers(rows);
          if (rows.length > 0) {
            setSupplierId(rows[0].id);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (supplierId === "") {
      setPayload(null);
      return;
    }
    let cancelled = false;
    async function loadProducts() {
      setLoadingProducts(true);
      setError(null);
      setPayload(null);
      try {
        const res = await fetch(`/api/buyer/products?supplierId=${supplierId}`);
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message ?? t("error"));
        }
        if (!cancelled) {
          setPayload(result.data as ProductsPayload);
          setQuantities({});
          setExpandedId(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("error"));
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }
    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [supplierId, t]);

  async function addToCart(productId: number, e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const raw = quantities[productId] ?? "1";
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError(t("buyer_invalid_qty"));
      return;
    }
    try {
      const res = await fetch("/api/buyer/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: qty }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setMessage(t("buyer_added_to_cart"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">{t("loading")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">{t("suppliers")}</label>
          <select
            className="min-w-[14rem] rounded border border-slate-300 px-2 py-2 text-sm"
            value={supplierId === "" ? "" : String(supplierId)}
            onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : "")}
          >
            {suppliers.length === 0 ? (
              <option value="">{t("no_data")}</option>
            ) : (
              suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name ?? s.supplier_name}
                </option>
              ))
            )}
          </select>
        </div>
        {supplierLabel ? (
          <p className="text-sm text-slate-600">
            {t("buyer_selected_supplier")}: <span className="font-medium">{supplierLabel}</span>
          </p>
        ) : null}
      </div>

      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}

      {loadingProducts ? <p className="text-sm text-slate-500">{t("loading")}</p> : null}

      {!loadingProducts && payload && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {t("buyer_form_label")}: {payload.form.name}
          </p>
          <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {payload.products.map((p) => (
              <li key={p.id} className="p-3">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-start gap-3 text-left"
                  onClick={() => setExpandedId((id) => (id === p.id ? null : p.id))}
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-slate-100 bg-slate-50">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">—</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{p.displayName}</p>
                    <p className="text-sm text-slate-600">
                      {p.unitPrice != null ? `${p.unitPrice.toLocaleString()}` : "—"}
                    </p>
                    <p className="text-xs text-slate-400">{expandedId === p.id ? "▼" : "▶"} 상세</p>
                  </div>
                </button>
                {expandedId === p.id ? (
                  <dl className="mt-2 grid gap-1 border-t border-slate-100 pt-2 text-sm">
                    {p.detailRows.map((row) => (
                      <div key={row.field_key} className="grid grid-cols-[8rem_1fr] gap-2">
                        <dt className="text-slate-500">{row.field_label}</dt>
                        <dd className="text-slate-800">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <form
                  className="mt-2 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => addToCart(p.id, e)}
                >
                  <label className="text-xs text-slate-600">{t("buyer_qty")}</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                    value={quantities[p.id] ?? "1"}
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  <button
                    type="submit"
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
                  >
                    {t("buyer_add_cart")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {payload.products.length === 0 ? (
            <p className="text-sm text-slate-500">{t("no_data")}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
