import { ApiTable } from "@/components/portal/api-table";

export default function AdminCategoriesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">카테고리 관리</h1>
      <p className="text-sm text-slate-600">
        공급사별 카테고리(정렬/활성 상태)를 관리합니다.
      </p>
      <ApiTable endpoint="/api/admin/categories" title="카테고리 목록" />
    </div>
  );
}
