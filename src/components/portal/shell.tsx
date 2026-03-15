"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
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
  { href: "/admin/profile", labelKey: "profile" },
  { href: "/admin/translations", labelKey: "translations" },
];

const koreaSupplyAdminMenu: MenuItem[] = [
  { href: "/admin/supply-dashboard", labelKey: "supply_dashboard" },
  { href: "/admin/orders", labelKey: "orders" },
  { href: "/admin/suppliers", labelKey: "suppliers" },
  { href: "/admin/profile", labelKey: "profile" },
  { href: "/admin/translations", labelKey: "translations" },
];

const buyerMenu: MenuItem[] = [
  { href: "/buyer", labelKey: "dashboard" },
  { href: "/buyer/orders", labelKey: "my_orders" },
  { href: "/buyer/profile", labelKey: "profile" },
];

const supplierMenu: MenuItem[] = [
  { href: "/supplier", labelKey: "dashboard" },
  { href: "/supplier/orders", labelKey: "my_orders" },
  { href: "/supplier/products", labelKey: "products" },
  { href: "/supplier/profile", labelKey: "profile" },
];

function getMenu(pathname: string, role: string | null) {
  if (pathname.startsWith("/buyer")) return buyerMenu;
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

  useEffect(() => {
    async function loadMe() {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();
        if (response.ok && result.success && result.data?.role) {
          setRole(result.data.role as string);
          loadLanguage((result.data.language as SupportedLanguage | undefined) ?? "en");
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
    setLanguage(nextLanguage);
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
    <div className={`flex min-h-screen bg-slate-100 ${isRTL ? "flex-row-reverse" : ""}`}>
      <aside className={`w-60 border-slate-200 bg-white p-4 ${isRTL ? "border-l" : "border-r"}`}>
        <h1 className="text-lg font-bold">{t("app_name")}</h1>
        <nav className="mt-4 space-y-1">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded px-3 py-2 text-sm ${
                pathname === item.href
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <button
          onClick={onLogout}
          className="mt-6 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {t("logout")}
        </button>
      </aside>
      <main className="flex-1 p-6">
        <div className={`mb-4 flex items-center gap-3 ${isRTL ? "justify-start" : "justify-end"}`}>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span>{t("language")}</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 text-sm"
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
