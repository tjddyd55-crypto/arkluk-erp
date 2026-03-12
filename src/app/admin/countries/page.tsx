import { ApiTable } from "@/components/portal/api-table";

export default function AdminCountriesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">국가 관리</h1>
      <p className="text-sm text-slate-600">
        바이어 확장 국가를 등록하고 주문/바이어 목록의 국가 필터 기준을 운영합니다.
      </p>
      <ApiTable endpoint="/api/admin/countries" title="국가 목록" />
    </div>
  );
}
