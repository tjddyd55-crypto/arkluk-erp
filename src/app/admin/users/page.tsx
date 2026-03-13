import { AdminUserManagement } from "@/components/portal/admin-user-management";

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">사용자 관리</h1>
      <p className="text-sm text-slate-600">
        공급사 로그인 계정을 생성하고 공급사와 연결합니다.
      </p>
      <AdminUserManagement />
    </div>
  );
}
