-- CreateEnum
CREATE TYPE "BuyerOrderStatus" AS ENUM (
  'ORDER_CREATED',
  'PAYMENT_PENDING',
  'PAYMENT_COMPLETED',
  'ORDER_CANCELLED'
);

-- CreateEnum
CREATE TYPE "SupplierShipmentStatus" AS ENUM (
  'CONFIRMED',
  'PREPARING',
  'PACKING',
  'SHIPPED',
  'DELIVERED',
  'HOLD'
);

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "buyer_status" "BuyerOrderStatus" NOT NULL DEFAULT 'ORDER_CREATED',
ADD COLUMN "buyer_status_updated_by" INTEGER,
ADD COLUMN "buyer_status_updated_at" TIMESTAMP(3);

ALTER TABLE "Shipment"
ADD COLUMN "supplier_status" "SupplierShipmentStatus" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN "supplier_status_updated_by" INTEGER,
ADD COLUMN "supplier_status_updated_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_buyer_id_buyer_status_idx" ON "Order"("buyer_id", "buyer_status");
CREATE INDEX "Shipment_supplier_status_created_at_idx" ON "Shipment"("supplier_status", "created_at");

-- AddForeignKey
ALTER TABLE "Order"
ADD CONSTRAINT "Order_buyer_status_updated_by_fkey"
FOREIGN KEY ("buyer_status_updated_by") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Shipment"
ADD CONSTRAINT "Shipment_supplier_status_updated_by_fkey"
FOREIGN KEY ("supplier_status_updated_by") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
