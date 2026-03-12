import { ApiTable } from "@/components/portal/api-table";

export default function BuyerQuotesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">받은 견적 목록</h1>
      <p className="text-sm text-slate-600">
        상세 API에서 견적 확인 후 승인 시 주문으로 전환됩니다.
      </p>
      <ApiTable endpoint="/api/buyer/quotes" title="견적 목록" />
    </div>
  );
}
