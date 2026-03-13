-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM (
  'ORDER_CREATED',
  'ORDER_ASSIGNED',
  'SUPPLIER_CONFIRMED',
  'SHIPMENT_SHIPPED',
  'SHIPMENT_DELIVERED'
);

-- CreateTable
CREATE TABLE "Notification" (
  "id" SERIAL NOT NULL,
  "event_type" "NotificationEvent" NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
  "id" SERIAL NOT NULL,
  "notification_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_event_type_created_at_idx"
ON "Notification"("event_type", "created_at");

CREATE INDEX "Notification_entity_type_entity_id_idx"
ON "Notification"("entity_type", "entity_id");

CREATE UNIQUE INDEX "NotificationRecipient_notification_id_user_id_key"
ON "NotificationRecipient"("notification_id", "user_id");

CREATE INDEX "NotificationRecipient_user_id_is_read_created_at_idx"
ON "NotificationRecipient"("user_id", "is_read", "created_at");

CREATE INDEX "NotificationRecipient_notification_id_idx"
ON "NotificationRecipient"("notification_id");

-- AddForeignKey
ALTER TABLE "NotificationRecipient"
ADD CONSTRAINT "NotificationRecipient_notification_id_fkey"
FOREIGN KEY ("notification_id") REFERENCES "Notification"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationRecipient"
ADD CONSTRAINT "NotificationRecipient_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
