import { ApiTable } from "@/components/portal/api-table";

export default function SupplierProductsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">공급사 상품 목록</h1>
      <p className="text-sm text-slate-600">
        1차 MVP는 조회 중심이며, `allow_supplier_product_edit` 활성 시 수정 API를 사용할 수 있습니다.
      </p>
      <ApiTable endpoint="/api/supplier/products" title="내 상품 목록" />
    </div>
  );
}
