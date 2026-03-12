import { ApiTable } from "@/components/portal/api-table";

export default function BuyerOrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">내 주문 목록</h1>
      <ApiTable endpoint="/api/buyer/orders" title="주문 목록" />
    </div>
  );
}
