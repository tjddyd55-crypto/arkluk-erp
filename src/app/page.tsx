"use client";

import Link from "next/link";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";
import { useTranslation } from "@/hooks/useTranslation";

export default function Home() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-slate-100 p-10">
      <div className="mx-auto mb-3 flex max-w-5xl justify-end">
        <PublicLanguageSwitcher />
      </div>
      <main className="mx-auto max-w-5xl rounded-lg bg-white p-10 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">{t("app_name")}</h1>
        <p className="mt-2 text-slate-600">
          {t("dashboard")}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border border-slate-200 p-4">
            <h2 className="font-semibold">{t("role_super_admin_dashboard")}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("suppliers")} / {t("categories")} / {t("products")} / {t("orders")} / {t("quotes")}
            </p>
            <Link
              href="/admin"
              className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white"
            >
              {t("dashboard")}
            </Link>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <h2 className="font-semibold">{t("role_buyer_dashboard")}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("create_order")} / {t("my_orders")} / {t("quotes")}
            </p>
            <Link
              href="/buyer"
              className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white"
            >
              {t("dashboard")}
            </Link>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <h2 className="font-semibold">{t("role_supplier_dashboard")}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("my_orders")} / {t("my_products")} / {t("my_quotes")}
            </p>
            <Link
              href="/supplier"
              className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white"
            >
              {t("dashboard")}
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <Link href="/login" className="text-sm font-medium text-blue-700 underline">
            {t("login")}
          </Link>
        </div>
      </main>
    </div>
  );
}
