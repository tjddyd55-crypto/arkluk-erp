-- 새 enum
CREATE TYPE "OsPdfStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
CREATE TYPE "OsEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "PoPdfDownloadType" AS ENUM ('COMBINED', 'SUPPLIER_SECTION');

-- OrderSupplierStatus: VIEWED 추가
ALTER TYPE "OrderSupplierStatus" ADD VALUE 'VIEWED';

-- NotificationEvent
ALTER TYPE "NotificationEvent" ADD VALUE 'SUPPLIER_REJECTED';

-- Order: 통합 PDF 처리 상태
ALTER TABLE "Order" ADD COLUMN "combined_pdf_status" "OsPdfStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Order" ADD COLUMN "combined_pdf_last_error" TEXT;
ALTER TABLE "Order" ADD COLUMN "combined_pdf_generated_at" TIMESTAMP(3);

-- OrderSupplier: PDF/메일/열람/거절/완료/추적
ALTER TABLE "OrderSupplier" ADD COLUMN "pdf_status" "OsPdfStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "OrderSupplier" ADD COLUMN "pdf_last_error" TEXT;
ALTER TABLE "OrderSupplier" ADD COLUMN "pdf_generated_at" TIMESTAMP(3);
ALTER TABLE "OrderSupplier" ADD COLUMN "email_status" "OsEmailStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "OrderSupplier" ADD COLUMN "email_last_error" TEXT;
ALTER TABLE "OrderSupplier" ADD COLUMN "email_sent_at" TIMESTAMP(3);
ALTER TABLE "OrderSupplier" ADD COLUMN "email_sent_to" VARCHAR(512);
ALTER TABLE "OrderSupplier" ADD COLUMN "viewed_at" TIMESTAMP(3);
ALTER TABLE "OrderSupplier" ADD COLUMN "rejected_at" TIMESTAMP(3);
ALTER TABLE "OrderSupplier" ADD COLUMN "completed_at" TIMESTAMP(3);
ALTER TABLE "OrderSupplier" ADD COLUMN "tracking_number" VARCHAR(128);
ALTER TABLE "OrderSupplier" ADD COLUMN "reject_reason" TEXT;

-- 기존 데이터 백필
UPDATE "Order" SET "combined_pdf_status" = 'SUCCESS' WHERE "combined_po_pdf_path" IS NOT NULL;
UPDATE "OrderSupplier" SET "pdf_status" = 'SUCCESS' WHERE "supplier_po_pdf_path" IS NOT NULL;
UPDATE "OrderSupplier" SET "email_status" = 'SENT' WHERE "email_sent" = true;

-- PDF 다운로드 로그
CREATE TABLE "PoPdfDownloadLog" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "order_supplier_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "download_type" "PoPdfDownloadType" NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoPdfDownloadLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PoPdfDownloadLog_order_id_downloaded_at_idx" ON "PoPdfDownloadLog"("order_id", "downloaded_at");
CREATE INDEX "PoPdfDownloadLog_user_id_downloaded_at_idx" ON "PoPdfDownloadLog"("user_id", "downloaded_at");

ALTER TABLE "PoPdfDownloadLog" ADD CONSTRAINT "PoPdfDownloadLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoPdfDownloadLog" ADD CONSTRAINT "PoPdfDownloadLog_order_supplier_id_fkey" FOREIGN KEY ("order_supplier_id") REFERENCES "OrderSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoPdfDownloadLog" ADD CONSTRAINT "PoPdfDownloadLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
