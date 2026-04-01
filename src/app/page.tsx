"use client";

import Link from "next/link";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";
import { useTranslation } from "@/hooks/useTranslation";

export default function Home() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#0f1115] p-10">
      <div className="mx-auto mb-3 flex max-w-5xl justify-end">
        <PublicLanguageSwitcher />
      </div>
      <main className="mx-auto max-w-5xl rounded-lg border border-[#2d333d] bg-[#1a1d23] p-10 shadow-sm shadow-black/20">
        <h1 className="text-3xl font-bold text-white">{t("app_name")}</h1>
        <p className="mt-2 text-gray-400">{t("dashboard")}</p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[#2d333d] bg-[#1a1d23] p-4">
            <h2 className="font-semibold text-white">{t("role_super_admin_dashboard")}</h2>
            <p className="mt-2 text-sm text-gray-400">
              {t("suppliers")} / {t("categories")} / {t("products")} / {t("orders")} / {t("quotes")}
            </p>
            <Link
              href="/admin"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              {t("dashboard")}
            </Link>
          </div>

          <div className="rounded-lg border border-[#2d333d] bg-[#1a1d23] p-4">
            <h2 className="font-semibold text-white">{t("role_buyer_dashboard")}</h2>
            <p className="mt-2 text-sm text-gray-400">
              {t("create_order")} / {t("my_orders")} / {t("quotes")}
            </p>
            <Link
              href="/buyer"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              {t("dashboard")}
            </Link>
          </div>

          <div className="rounded-lg border border-[#2d333d] bg-[#1a1d23] p-4">
            <h2 className="font-semibold text-white">{t("role_supplier_dashboard")}</h2>
            <p className="mt-2 text-sm text-gray-400">
              {t("my_orders")} / {t("my_products")} / {t("my_quotes")}
            </p>
            <Link
              href="/supplier"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              {t("dashboard")}
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <Link href="/login" className="text-sm font-medium text-blue-400 underline hover:text-blue-300">
            {t("login")}
          </Link>
        </div>
      </main>
    </div>
  );
}
