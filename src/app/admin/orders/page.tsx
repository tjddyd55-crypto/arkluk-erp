import { AdminOrdersList } from "@/components/portal/admin-orders-list";
import { AdminCentralReviewDashboard } from "@/components/portal/admin-central-review-dashboard";
import { AssignmentSettingsPanel } from "@/components/portal/assignment-settings-panel";

export default function AdminOrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">주문 관리</h1>
      <p className="text-sm text-slate-600">
        국가/바이어/상태 필터로 주문을 조회하고, 상세에서 공급사별 분리/발송을 운영합니다.
      </p>
      <AssignmentSettingsPanel />
      <AdminCentralReviewDashboard />
      <AdminOrdersList />
    </div>
  );
}
