import Link from "next/link";

import { ApiTable } from "@/components/portal/api-table";

export default function AdminProductsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">상품 관리</h1>
      <p className="text-sm text-slate-600">
        공급사/카테고리 기반 상품 CRUD, 검색, 엑셀 업로드/다운로드를 수행합니다.
      </p>
      <div className="flex gap-2 text-sm">
        <Link
          href="/api/admin/products/excel/download"
          className="rounded border border-slate-300 px-3 py-1"
        >
          상품 엑셀 다운로드
        </Link>
      </div>
      <ApiTable endpoint="/api/admin/products" title="상품 목록" />
    </div>
  );
}
