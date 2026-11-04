-- AlterTable
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emiratesId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Employee_clientId_emiratesId_idx" ON "Employee"("clientId", "emiratesId");

-- AlterTable
ALTER TABLE "PatrolCheckpoint" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);


