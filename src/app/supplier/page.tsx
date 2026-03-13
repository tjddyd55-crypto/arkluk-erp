import Link from "next/link";

import { ApiTable } from "@/components/portal/api-table";

export default function SupplierDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">공급사 대시보드</h1>
      <p className="text-sm text-slate-600">
        My Orders에서 배정된 주문을 확인하고, 주문 확인/출고/납품 상태를 업데이트합니다.
      </p>
      <div className="flex items-center gap-2 text-sm">
        <Link href="/supplier/orders" className="rounded border border-slate-300 px-3 py-1">
          My Orders 이동
        </Link>
      </div>
      <ApiTable endpoint="/api/supplier/orders" title="My Orders 요약" />
    </div>
  );
}
