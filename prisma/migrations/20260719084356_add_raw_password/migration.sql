/*
  Warnings:

  - A unique constraint covering the columns `[entity,clientId]` on the table `Counter` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."GuardAssignment" DROP CONSTRAINT "GuardAssignment_patrolRouteId_fkey";

-- DropIndex
DROP INDEX "public"."Counter_entity_key";

-- AlterTable
ALTER TABLE "public"."Counter" ADD COLUMN     "clientId" TEXT NOT NULL DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE "public"."GuardAssignment" ADD COLUMN     "assignmentType" TEXT NOT NULL DEFAULT 'ROUTE',
ALTER COLUMN "patrolRouteId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."PatrolCheckpoint" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "rawPassword" TEXT;

-- CreateTable
CREATE TABLE "public"."GuardAssignmentGate" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardAssignmentGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Incident" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "patrolSessionId" TEXT,
    "gateId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardAssignmentGate_assignmentId_idx" ON "public"."GuardAssignmentGate"("assignmentId");

-- CreateIndex
CREATE INDEX "GuardAssignmentGate_gateId_idx" ON "public"."GuardAssignmentGate"("gateId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardAssignmentGate_assignmentId_gateId_key" ON "public"."GuardAssignmentGate"("assignmentId", "gateId");

-- CreateIndex
CREATE INDEX "Incident_clientId_idx" ON "public"."Incident"("clientId");

-- CreateIndex
CREATE INDEX "Incident_employeeId_idx" ON "public"."Incident"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_entity_clientId_key" ON "public"."Counter"("entity", "clientId");

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_patrolRouteId_fkey" FOREIGN KEY ("patrolRouteId") REFERENCES "public"."PatrolRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignmentGate" ADD CONSTRAINT "GuardAssignmentGate_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."GuardAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignmentGate" ADD CONSTRAINT "GuardAssignmentGate_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
