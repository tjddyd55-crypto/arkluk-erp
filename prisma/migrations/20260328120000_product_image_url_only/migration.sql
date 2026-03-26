-- 단일 상품 이미지 컬럼(image_url)으로 통합 후 레거시 컬럼 제거

UPDATE "Product"
SET "image_url" = COALESCE(
  NULLIF(TRIM("image_url"), ''),
  NULLIF(TRIM("thumbnail_url"), ''),
  NULLIF(TRIM("product_image_url"), '')
)
WHERE ("image_url" IS NULL OR TRIM("image_url") = '')
  AND (
    ("thumbnail_url" IS NOT NULL AND TRIM("thumbnail_url") <> '')
    OR ("product_image_url" IS NOT NULL AND TRIM("product_image_url") <> '')
  );

ALTER TABLE "Product" DROP COLUMN "thumbnail_url";
ALTER TABLE "Product" DROP COLUMN "product_image_url";
