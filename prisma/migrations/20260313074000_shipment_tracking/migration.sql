-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Shipment" (
  "id" SERIAL NOT NULL,
  "order_supplier_id" INTEGER NOT NULL,
  "shipment_no" TEXT NOT NULL,
  "carrier" TEXT,
  "tracking_number" TEXT,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
  "shipped_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
  "id" SERIAL NOT NULL,
  "shipment_id" INTEGER NOT NULL,
  "order_item_id" INTEGER NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipment_no_key" ON "Shipment"("shipment_no");
CREATE INDEX "Shipment_order_supplier_id_created_at_idx" ON "Shipment"("order_supplier_id", "created_at");
CREATE INDEX "Shipment_status_created_at_idx" ON "Shipment"("status", "created_at");
CREATE UNIQUE INDEX "ShipmentItem_shipment_id_order_item_id_key" ON "ShipmentItem"("shipment_id", "order_item_id");
CREATE INDEX "ShipmentItem_order_item_id_created_at_idx" ON "ShipmentItem"("order_item_id", "created_at");

-- AddForeignKey
ALTER TABLE "Shipment"
ADD CONSTRAINT "Shipment_order_supplier_id_fkey"
FOREIGN KEY ("order_supplier_id") REFERENCES "OrderSupplier"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShipmentItem"
ADD CONSTRAINT "ShipmentItem_shipment_id_fkey"
FOREIGN KEY ("shipment_id") REFERENCES "Shipment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShipmentItem"
ADD CONSTRAINT "ShipmentItem_order_item_id_fkey"
FOREIGN KEY ("order_item_id") REFERENCES "OrderItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
