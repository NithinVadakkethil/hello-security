-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "FaceEnrollmentStatus" AS ENUM ('PENDING', 'REGISTERED', 'ACTIVE', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FaceEnrollment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "FaceEnrollmentStatus" NOT NULL DEFAULT 'REGISTERED',
    "encryptedTemplate" TEXT NOT NULL,
    "modelName" TEXT NOT NULL DEFAULT 'MobileFaceNet',
    "modelVersion" TEXT NOT NULL DEFAULT 'v1',
    "embeddingDimension" INTEGER NOT NULL DEFAULT 512,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FaceEnrollment_employeeId_key" ON "FaceEnrollment"("employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FaceEnrollment_clientId_idx" ON "FaceEnrollment"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FaceEnrollment_employeeId_idx" ON "FaceEnrollment"("employeeId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FaceEnrollment_employeeId_fkey') THEN
        ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FaceEnrollment_clientId_fkey') THEN
        ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
