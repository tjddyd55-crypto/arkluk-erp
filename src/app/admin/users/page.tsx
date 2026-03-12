import { ApiTable } from "@/components/portal/api-table";

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">사용자 관리</h1>
      <p className="text-sm text-slate-600">
        SUPER_ADMIN/ADMIN/BUYER/SUPPLIER 계정을 생성하고 활성 상태를 관리합니다.
      </p>
      <ApiTable endpoint="/api/admin/users" title="사용자 목록" />
    </div>
  );
}
