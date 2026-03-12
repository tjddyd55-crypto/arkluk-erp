import { BuyerProjectsList } from "@/components/portal/buyer-projects-list";

export default function BuyerProjectsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">내 프로젝트</h1>
      <p className="text-sm text-slate-600">
        프로젝트별 견적/주문/발주/세금계산서 흐름을 확인합니다.
      </p>
      <BuyerProjectsList />
    </div>
  );
}
