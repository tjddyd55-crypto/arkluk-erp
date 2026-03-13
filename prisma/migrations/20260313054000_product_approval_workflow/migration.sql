-- CreateEnum
CREATE TYPE "ProductApprovalAction" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "rejection_reason" TEXT;

-- CreateTable
CREATE TABLE "ProductApprovalLog" (
  "id" SERIAL NOT NULL,
  "product_id" INTEGER NOT NULL,
  "action" "ProductApprovalAction" NOT NULL,
  "actor_user_id" INTEGER NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductApprovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductApprovalLog_product_id_created_at_idx"
ON "ProductApprovalLog"("product_id", "created_at");

CREATE INDEX "ProductApprovalLog_actor_user_id_created_at_idx"
ON "ProductApprovalLog"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ProductApprovalLog"
ADD CONSTRAINT "ProductApprovalLog_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductApprovalLog"
ADD CONSTRAINT "ProductApprovalLog_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
