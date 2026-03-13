"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { NotificationBell } from "@/components/portal/notification-bell";

type MenuItem = {
  href: string;
  label: string;
};

const superAdminMenu: MenuItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/countries", label: "Countries" },
  { href: "/admin/users", label: "Users" },
];

const koreaSupplyAdminMenu: MenuItem[] = [
  { href: "/admin/supply-dashboard", label: "Supply Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/suppliers", label: "Suppliers" },
];

const buyerMenu: MenuItem[] = [
  { href: "/buyer", label: "Dashboard" },
  { href: "/buyer/orders", label: "My Orders" },
  { href: "/buyer/profile", label: "Profile" },
];

const supplierMenu: MenuItem[] = [
  { href: "/supplier", label: "Dashboard" },
  { href: "/supplier/orders", label: "My Orders" },
  { href: "/supplier/products", label: "Products" },
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
  const menu = getMenu(pathname, role);

  useEffect(() => {
    async function loadMe() {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();
        if (response.ok && result.success && result.data?.role) {
          setRole(result.data.role as string);
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

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-60 border-r border-slate-200 bg-white p-4">
        <h1 className="text-lg font-bold">ARKLUX ERP</h1>
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
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={onLogout}
          className="mt-6 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          로그아웃
        </button>
      </aside>
      <main className="flex-1 p-6">
        <div className="mb-4 flex justify-end">
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
