-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "name_original" TEXT,
ADD COLUMN "description_original" TEXT,
ADD COLUMN "source_language" "Language" NOT NULL DEFAULT 'ko';

UPDATE "Product"
SET "name_original" = COALESCE(NULLIF("name", ''), "product_name")
WHERE "name_original" IS NULL;

UPDATE "Product"
SET "description_original" = COALESCE("description", "memo")
WHERE "description_original" IS NULL;

ALTER TABLE "Product"
ALTER COLUMN "name_original" SET NOT NULL;

-- CreateTable
CREATE TABLE "ProductTranslation" (
  "id" SERIAL NOT NULL,
  "product_id" INTEGER NOT NULL,
  "language" "Language" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_auto" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductTranslation_product_id_language_key" ON "ProductTranslation"("product_id", "language");
CREATE INDEX "ProductTranslation_language_idx" ON "ProductTranslation"("language");

-- AddForeignKey
ALTER TABLE "ProductTranslation"
ADD CONSTRAINT "ProductTranslation_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "contact_phone" TEXT;
