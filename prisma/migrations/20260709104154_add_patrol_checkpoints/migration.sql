/*
  Warnings:

  - You are about to drop the column `expectedDuration` on the `PatrolCheckpoint` table. All the data in the column will be lost.
  - You are about to drop the column `patrolRouteId` on the `PatrolCheckpoint` table. All the data in the column will be lost.
  - You are about to drop the column `sequence` on the `PatrolCheckpoint` table. All the data in the column will be lost.
  - Added the required column `patrolSessionId` to the `PatrolCheckpoint` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."PatrolCheckpoint" DROP CONSTRAINT "PatrolCheckpoint_patrolRouteId_fkey";

-- DropIndex
DROP INDEX "public"."PatrolCheckpoint_patrolRouteId_gateId_key";

-- DropIndex
DROP INDEX "public"."PatrolCheckpoint_patrolRouteId_sequence_key";

-- AlterTable
ALTER TABLE "public"."PatrolCheckpoint" DROP COLUMN "expectedDuration",
DROP COLUMN "patrolRouteId",
DROP COLUMN "sequence",
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "patrolSessionId" TEXT NOT NULL,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "PatrolCheckpoint_patrolSessionId_idx" ON "public"."PatrolCheckpoint"("patrolSessionId");

-- CreateIndex
CREATE INDEX "PatrolCheckpoint_gateId_idx" ON "public"."PatrolCheckpoint"("gateId");

-- AddForeignKey
ALTER TABLE "public"."PatrolCheckpoint" ADD CONSTRAINT "PatrolCheckpoint_patrolSessionId_fkey" FOREIGN KEY ("patrolSessionId") REFERENCES "public"."PatrolSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
