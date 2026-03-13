-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "name" TEXT,
ADD COLUMN "sku" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "specification" TEXT,
ADD COLUMN "thumbnail_url" TEXT,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KRW',
ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'APPROVED';

-- Backfill
UPDATE "Product"
SET
  "name" = COALESCE("name", "product_name"),
  "sku" = COALESCE("sku", "product_code"),
  "description" = COALESCE("description", "memo"),
  "specification" = COALESCE("specification", "spec"),
  "thumbnail_url" = COALESCE("thumbnail_url", "product_image_url");

-- Index
CREATE INDEX "Product_supplier_id_status_idx" ON "Product"("supplier_id", "status");
