import { SupplierManagement } from "@/components/portal/supplier-management";
import { SupplierInvoiceSettings } from "@/components/portal/supplier-invoice-settings";

export default function AdminSuppliersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">공급사 관리</h1>
      <p className="text-sm text-slate-600">
        공급사 추가/수정/활성화/정지와 발신 이메일 설정을 운영합니다.
      </p>
      <SupplierManagement />
      <SupplierInvoiceSettings />
    </div>
  );
}
