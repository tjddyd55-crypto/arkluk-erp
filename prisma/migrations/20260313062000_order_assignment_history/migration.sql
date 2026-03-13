-- CreateTable
CREATE TABLE "OrderAssignment" (
  "id" SERIAL NOT NULL,
  "order_item_id" INTEGER NOT NULL,
  "supplier_id" INTEGER NOT NULL,
  "assigned_by" INTEGER NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderAssignment_order_item_id_assigned_at_idx"
ON "OrderAssignment"("order_item_id", "assigned_at");

CREATE INDEX "OrderAssignment_supplier_id_assigned_at_idx"
ON "OrderAssignment"("supplier_id", "assigned_at");

CREATE INDEX "OrderAssignment_assigned_by_assigned_at_idx"
ON "OrderAssignment"("assigned_by", "assigned_at");

-- AddForeignKey
ALTER TABLE "OrderAssignment"
ADD CONSTRAINT "OrderAssignment_order_item_id_fkey"
FOREIGN KEY ("order_item_id") REFERENCES "OrderItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderAssignment"
ADD CONSTRAINT "OrderAssignment_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderAssignment"
ADD CONSTRAINT "OrderAssignment_assigned_by_fkey"
FOREIGN KEY ("assigned_by") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
