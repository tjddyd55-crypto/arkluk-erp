-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "country_code" TEXT;

ALTER TABLE "Order"
ADD COLUMN "country_code" TEXT;

-- Backfill Product.country_code from Supplier.country_code
UPDATE "Product" p
SET "country_code" = COALESCE(s."country_code", 'KR')
FROM "Supplier" s
WHERE p."supplier_id" = s."id";

-- Backfill Order.country_code from Country.country_code
UPDATE "Order" o
SET "country_code" = c."country_code"
FROM "Country" c
WHERE o."country_id" = c."id";

-- Apply constraints
ALTER TABLE "Product"
ALTER COLUMN "country_code" SET NOT NULL;

ALTER TABLE "Order"
ALTER COLUMN "country_code" SET NOT NULL;

-- Index
CREATE INDEX "Product_country_code_is_active_status_idx"
ON "Product"("country_code", "is_active", "status");
