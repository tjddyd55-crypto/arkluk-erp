import { AdminProjectsManager } from "@/components/portal/admin-projects-manager";

export default function AdminProjectsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">프로젝트 관리</h1>
      <p className="text-sm text-slate-600">
        프로젝트 단위로 견적/주문/발주/세금계산서를 추적합니다.
      </p>
      <AdminProjectsManager />
    </div>
  );
}
