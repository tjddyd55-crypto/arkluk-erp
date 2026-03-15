-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ko', 'en', 'mn', 'ar');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "language" "Language" NOT NULL DEFAULT 'en';
