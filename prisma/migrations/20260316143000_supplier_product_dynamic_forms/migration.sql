-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "image_url" TEXT;

-- CreateEnum
CREATE TYPE "SupplierProductFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'BOOLEAN', 'DATE');

-- CreateEnum
CREATE TYPE "SupplierProductFieldRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "SupplierProductForm" (
  "id" SERIAL NOT NULL,
  "supplier_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierProductForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProductField" (
  "id" SERIAL NOT NULL,
  "form_id" INTEGER NOT NULL,
  "field_key" TEXT NOT NULL,
  "field_label" TEXT NOT NULL,
  "field_type" "SupplierProductFieldType" NOT NULL,
  "is_required" BOOLEAN NOT NULL DEFAULT false,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "placeholder_text" TEXT,
  "help_text" TEXT,
  "validation_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierProductField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProductFieldValue" (
  "id" SERIAL NOT NULL,
  "product_id" INTEGER NOT NULL,
  "field_id" INTEGER NOT NULL,
  "value_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierProductFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProductFieldRequest" (
  "id" SERIAL NOT NULL,
  "supplier_id" INTEGER NOT NULL,
  "request_title" TEXT NOT NULL,
  "requested_field_label" TEXT NOT NULL,
  "requested_field_type" "SupplierProductFieldType" NOT NULL,
  "request_reason" TEXT NOT NULL,
  "status" "SupplierProductFieldRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierProductFieldRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierProductForm_supplier_id_is_active_idx"
ON "SupplierProductForm"("supplier_id", "is_active");
CREATE INDEX "SupplierProductForm_created_by_idx"
ON "SupplierProductForm"("created_by");
CREATE INDEX "SupplierProductForm_updated_by_idx"
ON "SupplierProductForm"("updated_by");

CREATE UNIQUE INDEX "SupplierProductField_form_id_field_key_key"
ON "SupplierProductField"("form_id", "field_key");
CREATE INDEX "SupplierProductField_form_id_is_enabled_sort_order_idx"
ON "SupplierProductField"("form_id", "is_enabled", "sort_order");

CREATE UNIQUE INDEX "SupplierProductFieldValue_product_id_field_id_key"
ON "SupplierProductFieldValue"("product_id", "field_id");
CREATE INDEX "SupplierProductFieldValue_field_id_idx"
ON "SupplierProductFieldValue"("field_id");

CREATE INDEX "SupplierProductFieldRequest_supplier_id_status_created_at_idx"
ON "SupplierProductFieldRequest"("supplier_id", "status", "created_at");
CREATE INDEX "SupplierProductFieldRequest_reviewed_by_idx"
ON "SupplierProductFieldRequest"("reviewed_by");

-- AddForeignKey
ALTER TABLE "SupplierProductForm"
ADD CONSTRAINT "SupplierProductForm_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierProductForm"
ADD CONSTRAINT "SupplierProductForm_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierProductForm"
ADD CONSTRAINT "SupplierProductForm_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierProductField"
ADD CONSTRAINT "SupplierProductField_form_id_fkey"
FOREIGN KEY ("form_id") REFERENCES "SupplierProductForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierProductFieldValue"
ADD CONSTRAINT "SupplierProductFieldValue_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierProductFieldValue"
ADD CONSTRAINT "SupplierProductFieldValue_field_id_fkey"
FOREIGN KEY ("field_id") REFERENCES "SupplierProductField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierProductFieldRequest"
ADD CONSTRAINT "SupplierProductFieldRequest_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierProductFieldRequest"
ADD CONSTRAINT "SupplierProductFieldRequest_reviewed_by_fkey"
FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default active form per supplier
INSERT INTO "SupplierProductForm" (
  "supplier_id",
  "name",
  "is_active",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at"
)
SELECT
  s."id",
  '기본 상품 등록 폼',
  true,
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Supplier" s
WHERE NOT EXISTS (
  SELECT 1
  FROM "SupplierProductForm" f
  WHERE f."supplier_id" = s."id" AND f."is_active" = true
);

-- Seed core fields for existing forms
INSERT INTO "SupplierProductField" (
  "form_id",
  "field_key",
  "field_label",
  "field_type",
  "is_required",
  "is_enabled",
  "sort_order",
  "placeholder_text",
  "help_text",
  "validation_json",
  "created_at",
  "updated_at"
)
SELECT
  f."id",
  seed."field_key",
  seed."field_label",
  seed."field_type"::"SupplierProductFieldType",
  seed."is_required",
  seed."is_enabled",
  seed."sort_order",
  seed."placeholder_text",
  seed."help_text",
  seed."validation_json",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SupplierProductForm" f
CROSS JOIN (
  VALUES
    ('sku', 'SKU', 'TEXT', true, true, 10, NULL, NULL, NULL::jsonb),
    ('name', '상품명', 'TEXT', true, true, 20, NULL, NULL, NULL::jsonb),
    ('specification', '규격', 'TEXT', true, true, 30, NULL, NULL, NULL::jsonb),
    ('price', '가격', 'NUMBER', true, true, 40, NULL, NULL, '{"min": 0.01}'::jsonb),
    ('currency', '통화', 'TEXT', false, true, 50, 'KRW', NULL, NULL::jsonb),
    ('description', '상품 설명', 'TEXTAREA', false, true, 60, NULL, NULL, NULL::jsonb),
    ('unit', '단위', 'TEXT', false, true, 70, 'EA', NULL, NULL::jsonb)
) AS seed("field_key", "field_label", "field_type", "is_required", "is_enabled", "sort_order", "placeholder_text", "help_text", "validation_json")
WHERE NOT EXISTS (
  SELECT 1
  FROM "SupplierProductField" pf
  WHERE pf."form_id" = f."id"
    AND pf."field_key" = seed."field_key"
);
