/*
  Warnings:

  - Added the required column `patrolRouteId` to the `GuardAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."GuardAssignment" ADD COLUMN     "patrolRouteId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "GuardAssignment_patrolRouteId_idx" ON "public"."GuardAssignment"("patrolRouteId");

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_patrolRouteId_fkey" FOREIGN KEY ("patrolRouteId") REFERENCES "public"."PatrolRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
