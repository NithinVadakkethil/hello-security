-- DropIndex
DROP INDEX "public"."PatrolRouteGate_gateId_idx";

-- DropIndex
DROP INDEX "public"."PatrolRouteGate_patrolRouteId_idx";

-- AlterTable
ALTER TABLE "public"."PatrolRouteGate" ADD COLUMN     "expectedDuration" INTEGER;
