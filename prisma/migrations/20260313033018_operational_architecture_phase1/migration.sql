-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('CREATED', 'ASSIGNED', 'SUPPLIER_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('MANUAL', 'AUTO_PRODUCT', 'AUTO_TIMEOUT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'CREATED';
ALTER TYPE "OrderStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "OrderStatus" ADD VALUE 'ASSIGNED';
ALTER TYPE "OrderStatus" ADD VALUE 'SUPPLIER_CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'KOREA_SUPPLY_ADMIN';
ALTER TYPE "Role" ADD VALUE 'COUNTRY_ADMIN';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "assigned_by" INTEGER,
ADD COLUMN     "assignment_mode" "AssignmentMode",
ADD COLUMN     "status" "OrderItemStatus" NOT NULL DEFAULT 'CREATED';

-- CreateIndex
CREATE INDEX "OrderItem_order_id_status_idx" ON "OrderItem"("order_id", "status");

-- CreateIndex
CREATE INDEX "OrderItem_supplier_id_status_idx" ON "OrderItem"("supplier_id", "status");
