import { ApiTable } from "@/components/portal/api-table";

export default function SupplierQuotesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">공급사 견적 목록</h1>
      <p className="text-sm text-slate-600">
        자기 공급사 상품만 포함된 견적을 생성/조회하고 발송합니다.
      </p>
      <ApiTable endpoint="/api/supplier/quotes" title="내 견적 목록" />
    </div>
  );
}
