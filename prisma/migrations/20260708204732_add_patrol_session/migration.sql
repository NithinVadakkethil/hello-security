-- CreateEnum
CREATE TYPE "public"."PatrolStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."PatrolSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "patrolCode" TEXT NOT NULL,
    "status" "public"."PatrolStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "pauseCount" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" INTEGER,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrolSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatrolSession_clientId_patrolCode_key" ON "public"."PatrolSession"("clientId", "patrolCode");

-- AddForeignKey
ALTER TABLE "public"."PatrolSession" ADD CONSTRAINT "PatrolSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolSession" ADD CONSTRAINT "PatrolSession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."GuardAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
