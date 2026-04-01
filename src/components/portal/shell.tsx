"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { BuyerSideNav } from "@/components/portal/buyer-side-nav";
import { NotificationBell } from "@/components/portal/notification-bell";
import { useTranslation } from "@/hooks/useTranslation";
import { loadLanguage, type SupportedLanguage } from "@/lib/i18n";

type MenuItem = {
  href: string;
  labelKey: string;
};

const superAdminMenu: MenuItem[] = [
  { href: "/admin/dashboard", labelKey: "dashboard" },
  { href: "/admin/orders", labelKey: "orders" },
  { href: "/admin/suppliers", labelKey: "suppliers" },
  { href: "/admin/countries", labelKey: "countries" },
  { href: "/admin/users", labelKey: "users" },
  { href: "/admin/products", labelKey: "products" },
  { href: "/admin/product-review", labelKey: "product_approval" },
  { href: "/admin/profile", labelKey: "profile" },
  { href: "/admin/translations", labelKey: "translations" },
];

const koreaSupplyAdminMenu: MenuItem[] = [
  { href: "/admin/supply-dashboard", labelKey: "supply_dashboard" },
  { href: "/admin/orders", labelKey: "orders" },
  { href: "/admin/suppliers", labelKey: "suppliers" },
  { href: "/admin/products", labelKey: "products" },
  { href: "/admin/product-review", labelKey: "product_approval" },
  { href: "/admin/profile", labelKey: "profile" },
  { href: "/admin/translations", labelKey: "translations" },
];

const supplierMenu: MenuItem[] = [
  { href: "/supplier", labelKey: "dashboard" },
  { href: "/supplier/orders", labelKey: "my_orders" },
  { href: "/supplier/products", labelKey: "products" },
  { href: "/supplier/collaboration/projects", labelKey: "supplier_collab_projects" },
  { href: "/supplier/profile", labelKey: "profile" },
];

function getMenu(pathname: string, role: string | null) {
  if (pathname.startsWith("/buyer")) return [];
  if (pathname.startsWith("/supplier")) return supplierMenu;
  if (role === "SUPER_ADMIN") {
    return superAdminMenu;
  }
  if (role === "KOREA_SUPPLY_ADMIN" || role === "ADMIN") {
    return koreaSupplyAdminMenu;
  }
  return superAdminMenu;
}

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const { t, language, setLanguage, isRTL } = useTranslation();
  const menu = getMenu(pathname, role);
  const isBuyerPortal = pathname.startsWith("/buyer");

  useEffect(() => {
    async function loadMe() {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();
        if (response.ok && result.success && result.data?.role) {
          setRole(result.data.role as string);
          loadLanguage((result.data.language as SupportedLanguage | undefined) ?? "en", {
            persist: false,
          });
        }
      } catch {
        // no-op
      }
    }
    loadMe();
  }, []);

  async function onLogout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  async function onChangeLanguage(nextLanguage: SupportedLanguage) {
    setLanguage(nextLanguage, { persist: false });
    try {
      await fetch("/api/auth/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: nextLanguage }),
      });
    } catch {
      // no-op
    }
  }

  return (
    <div className={`flex min-h-screen bg-[#0f1115] ${isRTL ? "flex-row-reverse" : ""}`}>
      <aside
        className={`w-60 border border-[#2d333d] bg-[#14171c] p-4 text-gray-300 ${
          isRTL ? "border-l" : "border-r"
        }`}
      >
        <h1 className="text-lg font-bold text-zinc-100">{t("app_name")}</h1>
        <nav className="mt-4 space-y-1">
          {isBuyerPortal ? (
            <BuyerSideNav />
          ) : (
            menu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-3 py-2 text-sm ${
                  pathname === item.href
                    ? "bg-[#23272f] text-white"
                    : "text-gray-400 hover:bg-[#23272f] hover:text-white"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            ))
          )}
        </nav>
        <button
          onClick={onLogout}
          className="mt-6 w-full rounded border border-[#3d4450] bg-[#2a3038] px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-[#323842]"
        >
          {t("logout")}
        </button>
      </aside>
      <main className="portal-main flex-1 bg-[#0f1115] p-6">
        <div
          className={`mb-4 flex items-center gap-3 text-zinc-400 ${isRTL ? "justify-start" : "justify-end"}`}
        >
          <label className="flex items-center gap-2 text-sm">
            <span>{t("language")}</span>
            <select
              className="rounded border border-[#2d333d] bg-[#14171c] px-2 py-1 text-sm text-white"
              value={language}
              onChange={(event) => onChangeLanguage(event.target.value as SupportedLanguage)}
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
              <option value="mn">Монгол</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
