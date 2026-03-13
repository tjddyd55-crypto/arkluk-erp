-- CreateTable
CREATE TABLE "SystemSetting" (
  "id" SERIAL NOT NULL,
  "setting_key" TEXT NOT NULL,
  "value_json" JSONB NOT NULL,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_setting_key_key" ON "SystemSetting"("setting_key");

-- AddForeignKey
ALTER TABLE "SystemSetting"
ADD CONSTRAINT "SystemSetting_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
