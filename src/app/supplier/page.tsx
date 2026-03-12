import { ApiTable } from "@/components/portal/api-table";

export default function SupplierDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">공급사 대시보드</h1>
      <p className="text-sm text-slate-600">
        발송된 자기 주문 확인, 주문 확인 처리, 자기 견적 생성/발송을 수행합니다.
      </p>
      <ApiTable endpoint="/api/supplier/orders" title="내 주문 요약" />
    </div>
  );
}
