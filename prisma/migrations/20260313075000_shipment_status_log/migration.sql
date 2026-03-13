-- CreateTable
CREATE TABLE "ShipmentStatusLog" (
  "id" SERIAL NOT NULL,
  "shipment_id" INTEGER NOT NULL,
  "status_message" TEXT NOT NULL,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShipmentStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentStatusLog_shipment_id_created_at_idx"
ON "ShipmentStatusLog"("shipment_id", "created_at");

CREATE INDEX "ShipmentStatusLog_created_by_created_at_idx"
ON "ShipmentStatusLog"("created_by", "created_at");

-- AddForeignKey
ALTER TABLE "ShipmentStatusLog"
ADD CONSTRAINT "ShipmentStatusLog_shipment_id_fkey"
FOREIGN KEY ("shipment_id") REFERENCES "Shipment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShipmentStatusLog"
ADD CONSTRAINT "ShipmentStatusLog_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
