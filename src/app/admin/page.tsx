import { ApiTable } from "@/components/portal/api-table";
import { DashboardSummary } from "@/components/portal/dashboard-summary";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">관리자 대시보드</h1>
        <p className="mt-1 text-sm text-slate-600">
          주문/견적/발송 운영 현황을 한눈에 확인합니다.
        </p>
      </header>

      <DashboardSummary />
      <ApiTable endpoint="/api/admin/orders" title="최근 주문 목록" />
    </div>
  );
}
