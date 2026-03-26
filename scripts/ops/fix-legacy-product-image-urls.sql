-- 운영 DB: 앱 상대 경로(/supplier/...) 등으로 저장된 상품 이미지 URL을 R2 공개 URL로 치환
-- 실행 전 백업 권장. <R2_PUBLIC_URL_BASE> 를 실제 공개 도메인으로 바꾼 뒤 검토·실행.
--
-- 이 프로젝트에는 ProductFile 테이블이 없고 Product.image_url / thumbnail_url / product_image_url 을 사용합니다.
--
-- 예: https://pub-xxxx.r2.dev (끝 슬래시 없음)
-- REPLACE 첫 인자는 실제 데이터에 맞게 조정 (예: '/supplier/arklux', 'supplier/arklux' 등)

BEGIN;

-- 패턴 A: /supplier/... 접두사 (잘못된 앱 경로)
UPDATE "Product"
SET "image_url" = REPLACE("image_url", '/supplier/arklux', '<R2_PUBLIC_URL_BASE>/products')
WHERE "image_url" IS NOT NULL AND "image_url" LIKE '/supplier/%';

UPDATE "Product"
SET "thumbnail_url" = REPLACE("thumbnail_url", '/supplier/arklux', '<R2_PUBLIC_URL_BASE>/products')
WHERE "thumbnail_url" IS NOT NULL AND "thumbnail_url" LIKE '/supplier/%';

UPDATE "Product"
SET "product_image_url" = REPLACE("product_image_url", '/supplier/arklux', '<R2_PUBLIC_URL_BASE>/products')
WHERE "product_image_url" IS NOT NULL AND "product_image_url" LIKE '/supplier/%';

-- 패턴 B: 레거시 객체 키만 저장된 경우(arklux/CODE/...) → 공개 URL + 키
-- (실제 키 규칙이 다르메 이 블록은 조정·삭제)
-- UPDATE "Product"
-- SET "image_url" = '<R2_PUBLIC_URL_BASE>/' || "image_url"
-- WHERE "image_url" IS NOT NULL AND "image_url" NOT LIKE 'http%' AND "image_url" NOT LIKE '/%';

COMMIT;
