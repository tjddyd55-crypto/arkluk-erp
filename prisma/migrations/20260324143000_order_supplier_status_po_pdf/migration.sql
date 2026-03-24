-- OrderSupplierStatus: 운영 명칭 정렬 + REJECTED
ALTER TYPE "OrderSupplierStatus" RENAME VALUE 'WAITING' TO 'PENDING';
ALTER TYPE "OrderSupplierStatus" RENAME VALUE 'SUPPLIER_CONFIRMED' TO 'CONFIRMED';
ALTER TYPE "OrderSupplierStatus" RENAME VALUE 'DELIVERING' TO 'SHIPPING';
ALTER TYPE "OrderSupplierStatus" ADD VALUE 'REJECTED';

-- 발주서 PDF 경로 (주문 생성 시 스냅샷)
ALTER TABLE "Order" ADD COLUMN "combined_po_pdf_path" VARCHAR(512);
ALTER TABLE "OrderSupplier" ADD COLUMN "supplier_po_pdf_path" VARCHAR(512);
ALTER TABLE "OrderSupplier" ADD COLUMN "po_snapshot_ref" VARCHAR(128);
ALTER TABLE "OrderSupplier" ALTER COLUMN "status" SET DEFAULT 'PENDING';
