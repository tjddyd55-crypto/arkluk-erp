-- 레거시: /supplier/... 등 잘못 저장된 상품 이미지를 CDN 절대 URL로 맞춘 뒤 image_url에만 둔다.
-- 실행 전 백업 권장. R2_PUBLIC_URL 예: https://cdn.platform-assets.com (끝 슬래시 없음)
-- 마이그레이션 `20260328120000_product_image_url_only` 적용 전 DB라면 thumbnail/product_image 컬럼 치환도 고려.

BEGIN;

-- image_url만 유지하는 정책 기준 패치 (접두 패턴은 데이터에 맞게 조정)
UPDATE "Product"
SET "image_url" = REPLACE("image_url", '/supplier/arklux', '<R2_PUBLIC_URL_BASE>/products')
WHERE "image_url" IS NOT NULL AND "image_url" LIKE '/supplier/%';

-- 마이그레이션 적용 전(컬럼이 아직 있을 때) 보조 치환:
-- UPDATE "Product" SET "image_url" = REPLACE("image_url", '/supplier/arklux', '<R2_PUBLIC_URL_BASE>/products')
-- WHERE ...

COMMIT;
