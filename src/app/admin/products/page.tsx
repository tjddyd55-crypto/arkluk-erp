"use client";

import Link from "next/link";

import { AdminProductCatalog } from "@/components/portal/admin-product-catalog";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminProductsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("products")}</h1>
      <p className="text-sm text-slate-600">{t("search")}</p>
      <div className="flex gap-2 text-sm">
        <Link
          href="/api/admin/products/excel/download"
          className="rounded border border-slate-300 px-3 py-1"
        >
          {t("products")} {t("download")}
        </Link>
      </div>
      <AdminProductCatalog />
    </div>
  );
}
