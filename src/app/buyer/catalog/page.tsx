import { BuyerProductCatalog } from "@/components/portal/buyer-product-catalog";

export default function BuyerCatalogPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">상품 카탈로그</h1>
      <p className="text-sm text-slate-600">
        BUYER는 본인 국가(`country_code`)에 매핑된 승인 상품만 조회할 수 있습니다.
      </p>
      <BuyerProductCatalog />
    </div>
  );
}
