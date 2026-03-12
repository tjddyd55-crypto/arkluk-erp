"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";

type MenuItem = {
  href: string;
  label: string;
};

const adminMenu: MenuItem[] = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/users", label: "사용자 관리" },
  { href: "/admin/countries", label: "국가 관리" },
  { href: "/admin/suppliers", label: "공급사 관리" },
  { href: "/admin/categories", label: "카테고리 관리" },
  { href: "/admin/products", label: "상품 관리" },
  { href: "/admin/projects", label: "프로젝트 관리" },
  { href: "/admin/orders", label: "주문 관리" },
  { href: "/admin/quotes", label: "견적 관리" },
  { href: "/admin/purchase-order-templates", label: "발주 템플릿" },
  { href: "/admin/tax-invoices", label: "세금계산서" },
  { href: "/admin/logs", label: "로그 관리" },
];

const buyerMenu: MenuItem[] = [
  { href: "/buyer", label: "주문 작성" },
  { href: "/buyer/projects", label: "내 프로젝트" },
  { href: "/buyer/orders", label: "내 주문" },
  { href: "/buyer/quotes", label: "받은 견적" },
];

const supplierMenu: MenuItem[] = [
  { href: "/supplier", label: "대시보드" },
  { href: "/supplier/orders", label: "주문 목록" },
  { href: "/supplier/quotes", label: "견적 목록" },
  { href: "/supplier/products", label: "상품 목록" },
];

function getMenu(pathname: string) {
  if (pathname.startsWith("/buyer")) return buyerMenu;
  if (pathname.startsWith("/supplier")) return supplierMenu;
  return adminMenu;
}

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const menu = getMenu(pathname);

  async function onLogout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-60 border-r border-slate-200 bg-white p-4">
        <h1 className="text-lg font-bold">ARKLUK ERP</h1>
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
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
