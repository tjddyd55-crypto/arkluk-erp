-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM (
  'ORDER_CREATED',
  'ORDER_REVIEWED',
  'ORDER_ASSIGNED',
  'SUPPLIER_CONFIRMED',
  'SHIPMENT_CREATED',
  'SHIPMENT_SHIPPED',
  'SHIPMENT_DELIVERED'
);

-- CreateTable
CREATE TABLE "OrderEventLog" (
  "id" SERIAL NOT NULL,
  "order_id" INTEGER NOT NULL,
  "event_type" "OrderEventType" NOT NULL,
  "message" TEXT NOT NULL,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEventLog_order_id_created_at_idx"
ON "OrderEventLog"("order_id", "created_at");

CREATE INDEX "OrderEventLog_event_type_created_at_idx"
ON "OrderEventLog"("event_type", "created_at");

CREATE INDEX "OrderEventLog_created_by_created_at_idx"
ON "OrderEventLog"("created_by", "created_at");

-- AddForeignKey
ALTER TABLE "OrderEventLog"
ADD CONSTRAINT "OrderEventLog_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderEventLog"
ADD CONSTRAINT "OrderEventLog_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
