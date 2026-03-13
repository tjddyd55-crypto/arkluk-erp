import { SuperAdminDashboard } from "@/components/portal/super-admin-dashboard";

export default function SuperAdminDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">SUPER_ADMIN Dashboard</h1>
      <p className="text-sm text-slate-600">
        전체 주문/배송 운영 현황을 조회합니다. 관리자 계정은 상태 변경이 불가합니다.
      </p>
      <SuperAdminDashboard />
    </div>
  );
}
