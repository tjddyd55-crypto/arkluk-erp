import { ApiTable } from "@/components/portal/api-table";

export default function AdminQuotesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">견적 관리</h1>
      <p className="text-sm text-slate-600">
        공급사 견적 목록 확인 및 관리자 통합 견적 생성/발송을 운영합니다.
      </p>
      <ApiTable endpoint="/api/admin/quotes" title="견적 목록" />
    </div>
  );
}
