"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/hooks/useTranslation";

type CartItem = {
  id: number;
  productId: number;
  supplierId: number;
  quantity: string;
  priceSnapshot: string;
  supplierLabel: string;
  displayName: string;
  lineTotal: string;
};

type Grouped = {
  supplierId: number;
  supplierLabel: string;
  items: CartItem[];
};

type CartResponse = {
  cartId: number | null;
  items: CartItem[];
  grouped: Grouped[];
};

export function BuyerCartView() {
  const { t } = useTranslation();
  const [data, setData] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/buyer/cart");
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setData(result.data as CartResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateQty(itemId: number) {
    setMessage(null);
    setError(null);
    const raw = qtyDraft[itemId];
    if (raw === undefined) return;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError(t("buyer_invalid_qty"));
      return;
    }
    try {
      const res = await fetch("/api/buyer/cart/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity: qty }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setQtyDraft((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    }
  }

  async function removeItem(itemId: number) {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/buyer/cart/item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    }
  }

  async function checkout() {
    setCheckoutLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/buyer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutFromCart: true }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message ?? t("error"));
      }
      setMessage(t("buyer_checkout_done"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading || !data) {
    return <p className="text-sm text-gray-400">{t("loading")}</p>;
  }

  const grandTotal = data.items.reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);

  return (
    <div className="space-y-4">
      {error ? <p className="rounded bg-red-950/30 p-2 text-sm text-red-400">{error}</p> : null}
      {message ? <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}

      {data.grouped.length === 0 ? (
        <p className="text-sm text-gray-400">{t("buyer_cart_empty")}</p>
      ) : (
        <>
          {data.grouped.map((g) => (
            <section key={g.supplierId} className="rounded border border-[#2d333d] bg-[#1a1d23] p-4">
              <h3 className="text-sm font-semibold text-white">{g.supplierLabel}</h3>
              <ul className="mt-2 space-y-3">
                {g.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex flex-wrap items-end justify-between gap-2 border-b border-[#2d333d] pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-300">{it.displayName}</p>
                      <p className="text-xs text-gray-400">
                        {t("buyer_unit_price")}: {Number(it.priceSnapshot).toLocaleString()} × {it.quantity}{" "}
                        = {Number(it.lineTotal).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        className="w-20 rounded border border-[#2d333d] px-2 py-1 text-sm"
                        placeholder={it.quantity}
                        value={qtyDraft[it.id] ?? ""}
                        onChange={(e) => setQtyDraft((prev) => ({ ...prev, [it.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="rounded border border-[#2d333d] px-2 py-1 text-xs"
                        onClick={() => updateQty(it.id)}
                      >
                        {t("apply")}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-400"
                        onClick={() => removeItem(it.id)}
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#2d333d] bg-[#111318] p-4">
            <p className="text-sm font-medium text-gray-300">
              {t("buyer_cart_total")}: {grandTotal.toLocaleString()}
            </p>
            <button
              type="button"
              disabled={checkoutLoading}
              onClick={() => void checkout()}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {checkoutLoading ? t("loading") : t("buyer_place_order")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
