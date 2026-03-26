-- 사업자·상품 라인 (건축자재 / 기타상품). 기존 행은 CONSTRUCTION.

CREATE TYPE "ProductCategory" AS ENUM ('CONSTRUCTION', 'GENERAL');

ALTER TABLE "Supplier" ADD COLUMN "product_category" "ProductCategory" NOT NULL DEFAULT 'CONSTRUCTION';

ALTER TABLE "Product" ADD COLUMN "product_category" "ProductCategory" NOT NULL DEFAULT 'CONSTRUCTION';

CREATE INDEX "Product_supplier_id_product_category_idx" ON "Product"("supplier_id", "product_category");
