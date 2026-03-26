import { ProductCategory } from "@prisma/client";

import { HttpError } from "@/lib/http";

/** 공급사 사업자 라인과 상품 라인이 다르면 거부 */
export function assertSupplierProductCategoryMatch(
  supplierCategory: ProductCategory,
  productCategory: ProductCategory,
): void {
  if (supplierCategory !== productCategory) {
    throw new HttpError(400, "카테고리 불일치: 사업자 유형과 상품 유형이 일치해야 합니다.");
  }
}

/**
 * 수정 직전: DB에 저장된 product.productCategory가 해당 시점 소속 공급사 라인과 일치하는지 검증.
 * 공급사 변경 PATCH 시에는 이전 공급사 라인과 상품 값이 맞는지 본 뒤, 저장 시 새 공급사 값으로 덮어쓴다.
 */
export function assertProductInvariantBeforeWrite(input: {
  product: { supplier_id: number; productCategory: ProductCategory };
  targetSupplierId: number;
  targetSupplierCategory: ProductCategory;
  previousSupplierCategory: ProductCategory;
}): void {
  const { product, targetSupplierId, targetSupplierCategory, previousSupplierCategory } = input;
  if (product.supplier_id === targetSupplierId) {
    assertSupplierProductCategoryMatch(targetSupplierCategory, product.productCategory);
    return;
  }
  assertSupplierProductCategoryMatch(previousSupplierCategory, product.productCategory);
}

/** 쓰기 시 항상 이 값만 사용 (클라이언트 무시) */
export function productCategoryForWrite(targetSupplierCategory: ProductCategory): ProductCategory {
  return targetSupplierCategory;
}

export function parseProductCategoryParam(value: string | null): ProductCategory | undefined {
  if (value === "CONSTRUCTION" || value === "GENERAL") {
    return value;
  }
  return undefined;
}
