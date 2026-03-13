-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Supplier"
ADD COLUMN "company_name" TEXT,
ADD COLUMN "company_code" TEXT,
ADD COLUMN "country_code" TEXT NOT NULL DEFAULT 'KR',
ADD COLUMN "business_number" TEXT,
ADD COLUMN "representative_name" TEXT,
ADD COLUMN "contact_name" TEXT,
ADD COLUMN "contact_email" TEXT,
ADD COLUMN "contact_phone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "status" "SupplierStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill
UPDATE "Supplier"
SET
  "company_name" = COALESCE("company_name", "supplier_name"),
  "company_code" = COALESCE("company_code", "supplier_code"),
  "contact_email" = COALESCE("contact_email", "order_email"),
  "status" = CASE WHEN "is_active" = true THEN 'ACTIVE'::"SupplierStatus" ELSE 'INACTIVE'::"SupplierStatus" END;

-- Enforce not null after backfill
ALTER TABLE "Supplier"
ALTER COLUMN "company_name" SET NOT NULL;

-- Indexes
CREATE UNIQUE INDEX "Supplier_company_code_key" ON "Supplier"("company_code");
CREATE INDEX "Supplier_status_country_code_idx" ON "Supplier"("status", "country_code");
