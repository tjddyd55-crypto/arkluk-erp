"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useTranslation } from "@/hooks/useTranslation";

type SupplierRow = {
  id: number;
  supplier_name: string;
  company_name: string | null;
};

function navLinkClass(active: boolean) {
  return `block rounded px-3 py-2 text-sm ${
    active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
  }`;
}

function BuyerShopNavSectionInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, isRTL } = useTranslation();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/buyer/suppliers");
        const result = await res.json();
        if (res.ok && result.success && !cancelled) {
          setSuppliers((result.data as SupplierRow[]) ?? []);
        }
      } catch {
        if (!cancelled) setSuppliers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onShop = pathname.startsWith("/buyer/shop");
  const activeSupplierId = searchParams.get("supplierId");
  const indent = isRTL ? "mr-2 border-r border-slate-200 pr-2" : "ml-2 border-l border-slate-200 pl-2";

  return (
    <div className="space-y-1">
      <Link
        href="/buyer/shop"
        className={`block rounded px-3 py-2 text-sm ${
          onShop && !activeSupplierId
            ? "bg-slate-900 text-white"
            : onShop
              ? "bg-slate-100 font-medium text-slate-900"
              : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        {t("buyer_shop_order")}
      </Link>
      <div className={`space-y-0.5 ${indent}`}>
        {loading ? (
          <p className="px-3 py-1 text-xs text-slate-400">{t("loading")}</p>
        ) : suppliers.length === 0 ? (
          <p className="px-3 py-1 text-xs text-slate-500">{t("buyer_no_suppliers")}</p>
        ) : (
          suppliers.map((s) => {
            const active = onShop && activeSupplierId === String(s.id);
            return (
              <Link
                key={s.id}
                href={`/buyer/shop?supplierId=${s.id}`}
                className={`block rounded px-3 py-1.5 text-sm ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s.company_name ?? s.supplier_name}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

export function BuyerShopNavSection() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="space-y-1">
          <div className="rounded px-3 py-2 text-sm text-slate-500">{t("buyer_shop_order")}</div>
          <p className="ml-2 text-xs text-slate-400">{t("loading")}</p>
        </div>
      }
    >
      <BuyerShopNavSectionInner />
    </Suspense>
  );
}

export function BuyerSideNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <>
      <Link href="/buyer" className={navLinkClass(pathname === "/buyer")}>
        {t("dashboard")}
      </Link>
      <BuyerShopNavSection />
      <Link href="/buyer/cart" className={navLinkClass(pathname === "/buyer/cart")}>
        {t("buyer_cart_menu")}
      </Link>
      <Link
        href="/buyer/collaboration/projects"
        className={navLinkClass(pathname.startsWith("/buyer/collaboration/projects"))}
      >
        협업 프로젝트
      </Link>
      <Link href="/buyer/orders" className={navLinkClass(pathname === "/buyer/orders")}>
        {t("buyer_order_history")}
      </Link>
      <Link href="/buyer/profile" className={navLinkClass(pathname === "/buyer/profile")}>
        {t("profile")}
      </Link>
    </>
  );
}
