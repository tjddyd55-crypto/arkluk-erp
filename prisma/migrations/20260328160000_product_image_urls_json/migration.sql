ALTER TABLE "Product" ADD COLUMN "image_urls" JSONB;

UPDATE "Product"
SET "image_urls" = to_jsonb(ARRAY["image_url"]::text[])
WHERE "image_url" IS NOT NULL AND btrim("image_url") <> '';

UPDATE "Product"
SET "image_urls" = '[]'::jsonb
WHERE "image_urls" IS NULL;
