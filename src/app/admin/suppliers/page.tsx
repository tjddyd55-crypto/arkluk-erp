import { SupplierInvoiceSettings } from "@/components/portal/supplier-invoice-settings";

export default function AdminSuppliersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">공급사 관리</h1>
      <p className="text-sm text-slate-600">
        발송 이메일, 비활성화, 공급사 상품 수정 플래그, 세금계산서 발신 이메일(다중)을 운영합니다.
      </p>
      <SupplierInvoiceSettings />
    </div>
  );
}
