"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useTranslation } from "@/hooks/useTranslation";

type ProductStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

type ProductRow = {
  id: number;
  displayName: string;
  unitPrice: number | null;
  image_url: string | null;
  detailRows: Array<{ field_key: string; field_label: string; value: string }>;
  status: ProductStatus;
  isActive: boolean;
  orderable: boolean;
};

type ProductsPayload = {
  form: { id: number; name: string };
  products: ProductRow[];
};

function parseSupplierId(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function productStatusBadgeKey(p: ProductRow): string {
  if (!p.isActive) return "buyer_product_inactive";
  if (p.status === "APPROVED") return "buyer_product_orderable";
  if (p.status === "PENDING") return "buyer_product_pending";
  if (p.status === "DRAFT") return "buyer_product_draft";
  if (p.status === "REJECTED") return "buyer_product_rejected";
  return "buyer_product_not_orderable";
}

function badgeClassName(p: ProductRow): string {
  if (!p.isActive) return "bg-slate-100 text-slate-700";
  if (p.status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  if (p.status === "PENDING") return "bg-amber-100 text-amber-900";
  if (p.status === "REJECTED") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

export function BuyerShopOrder() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const supplierId = parseSupplierId(searchParams.get("supplierId"));

  const [payload, setPayload] = useState<ProductsPayload | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (supplierId == null) {
      setPayload(null);
      setQuantities({});
      setExpandedId(null);
      setError(null);
      setLoadingProducts(false);
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

  async function addToCart(product: ProductRow, e: FormEvent) {
    e.preventDefault();
    if (!product.orderable) return;
    setMessage(null);
    setError(null);
    const raw = quantities[product.id] ?? "1";
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError(t("buyer_invalid_qty"));
      return;
    }
    try {
      const res = await fetch("/api/buyer/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: qty }),
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

  if (supplierId == null) {
    return (
      <p className="rounded border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        {t("buyer_pick_supplier_menu")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
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
                    {p.image_url?.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">—</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${badgeClassName(p)}`}
                    >
                      {t(productStatusBadgeKey(p))}
                    </span>
                    <p className="font-medium text-slate-900">{p.displayName}</p>
                    <p className="text-sm text-slate-600">
                      {p.unitPrice != null ? `${p.unitPrice.toLocaleString()}` : "—"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {expandedId === p.id ? "▼" : "▶"} {t("buyer_detail")}
                    </p>
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
                  className={`mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center ${
                    !p.orderable ? "opacity-70" : ""
                  }`}
                  onSubmit={(e) => addToCart(p, e)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-slate-600">{t("buyer_qty")}</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      disabled={!p.orderable}
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                      value={quantities[p.id] ?? "1"}
                      onChange={(e) => setQuantities((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <button
                      type="submit"
                      disabled={!p.orderable}
                      className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400"
                    >
                      {t("buyer_add_cart")}
                    </button>
                  </div>
                  {!p.orderable ? (
                    <p className="text-xs text-amber-800">{t("buyer_cart_blocked_hint")}</p>
                  ) : null}
                </form>
              </li>
            ))}
          </ul>
          {payload.products.length === 0 ? (
            <p className="text-sm text-slate-600">{t("buyer_no_products")}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
