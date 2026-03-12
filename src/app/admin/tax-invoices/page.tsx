import { TaxInvoiceMailbox } from "@/components/portal/tax-invoice-mailbox";

export default function AdminTaxInvoicesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">세금계산서 메일함</h1>
      <p className="text-sm text-slate-600">
        단일 수신 메일함에서 수집한 세금계산서를 발신 이메일 기준으로 공급사별 자동 분류합니다.
      </p>
      <TaxInvoiceMailbox />
    </div>
  );
}
