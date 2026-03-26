-- 공급사 신규 기본 상태: PENDING → ACTIVE (자동 승인·운영 단순화)
-- Prisma enum SupplierStatus: APPROVED 값 없음 → ACTIVE가 가동 승인 상태

ALTER TABLE "Supplier" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

UPDATE "Supplier"
SET "status" = 'ACTIVE',
    "is_active" = true
WHERE "status" = 'PENDING';
