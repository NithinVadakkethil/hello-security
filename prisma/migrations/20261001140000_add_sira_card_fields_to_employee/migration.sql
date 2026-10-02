-- AlterTable
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "siraCardExpiryDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "siraCardFrontImage" TEXT,
ADD COLUMN IF NOT EXISTS "siraCardBackImage" TEXT;
