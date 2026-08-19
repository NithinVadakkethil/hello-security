-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN "deviceId" TEXT,
ADD COLUMN "deviceInfo" TEXT;

-- CreateIndex
CREATE INDEX "RefreshToken_userId_deviceId_idx" ON "RefreshToken"("userId", "deviceId");
