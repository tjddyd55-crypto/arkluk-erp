import { BuyerOrderEntry } from "@/components/portal/buyer-order-entry";

export default function BuyerOrderPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">바이어 주문 작성</h1>
      <p className="text-sm text-slate-600">
        회사(공급사) 선택 기반으로 주문을 작성하고, 엑셀 템플릿 다운로드/업로드 주문을 수행합니다.
      </p>
      <BuyerOrderEntry />
    </div>
  );
}
