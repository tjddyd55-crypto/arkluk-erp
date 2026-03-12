import { PurchaseOrderTemplateManager } from "@/components/portal/purchase-order-template-manager";

export default function AdminPurchaseOrderTemplatesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">발주서 템플릿 관리</h1>
      <p className="text-sm text-slate-600">
        공급사별 발주서 템플릿을 등록하고, 기본 템플릿 fallback 정책을 운영합니다.
      </p>
      <PurchaseOrderTemplateManager />
    </div>
  );
}
