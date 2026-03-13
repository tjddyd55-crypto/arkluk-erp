import { BuyerOrderEntry } from "@/components/portal/buyer-order-entry";

export default function BuyerCreateOrderPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">주문 생성</h1>
      <p className="text-sm text-slate-600">
        BUYER는 즉시 주문 생성, COUNTRY_ADMIN은 초안 생성/품목추가/제출 흐름을 사용합니다.
      </p>
      <BuyerOrderEntry />
    </div>
  );
}
