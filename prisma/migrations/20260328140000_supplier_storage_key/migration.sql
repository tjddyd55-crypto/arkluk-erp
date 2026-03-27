-- 공급사별 R2 스토리지 세그먼트(선택). 비어 있으면 런타임에서 supplier.id 사용
ALTER TABLE "Supplier" ADD COLUMN "supplier_storage_key" TEXT;
