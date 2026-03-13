import { KoreaSupplyDashboard } from "@/components/portal/korea-supply-dashboard";

export default function KoreaSupplyAdminDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">KOREA_SUPPLY_ADMIN Dashboard</h1>
      <p className="text-sm text-slate-600">
        공급사 운영/배송 진행/지연 주문 현황을 조회합니다. 상태 변경 기능은 제공하지 않습니다.
      </p>
      <KoreaSupplyDashboard />
    </div>
  );
}
