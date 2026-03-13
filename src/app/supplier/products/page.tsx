import { SupplierProductManagement } from "@/components/portal/supplier-product-management";

export default function SupplierProductsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">공급사 상품 목록</h1>
      <p className="text-sm text-slate-600">
        내 상품을 등록하고 초안 수정 후 제출하면 관리자 승인 후 판매 상품으로 반영됩니다.
      </p>
      <SupplierProductManagement />
    </div>
  );
}
