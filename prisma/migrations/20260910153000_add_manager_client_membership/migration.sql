-- AlterTable
ALTER TABLE "PatrolSession" ALTER COLUMN "assignmentId" DROP NOT NULL;
ALTER TABLE "PatrolSession" ADD COLUMN IF NOT EXISTS "managerUserId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ManagerClientMembership" (
    "id" TEXT NOT NULL,
    "managerUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerClientMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ManagerClientMembership_managerUserId_clientId_key" ON "ManagerClientMembership"("managerUserId", "clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ManagerClientMembership_managerUserId_idx" ON "ManagerClientMembership"("managerUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ManagerClientMembership_clientId_idx" ON "ManagerClientMembership"("clientId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PatrolSession_managerUserId_fkey'
    ) THEN
        ALTER TABLE "PatrolSession" ADD CONSTRAINT "PatrolSession_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ManagerClientMembership_managerUserId_fkey'
    ) THEN
        ALTER TABLE "ManagerClientMembership" ADD CONSTRAINT "ManagerClientMembership_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ManagerClientMembership_clientId_fkey'
    ) THEN
        ALTER TABLE "ManagerClientMembership" ADD CONSTRAINT "ManagerClientMembership_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
