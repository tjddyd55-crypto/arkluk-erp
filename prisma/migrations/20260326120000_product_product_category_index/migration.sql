-- 단일 컬럼 필터·통계용 (복합 인덱스와 병행)
CREATE INDEX "Product_product_category_idx" ON "Product"("product_category");
