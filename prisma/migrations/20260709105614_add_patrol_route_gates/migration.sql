-- CreateTable
CREATE TABLE "public"."PatrolRouteGate" (
    "id" TEXT NOT NULL,
    "patrolRouteId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolRouteGate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatrolRouteGate_patrolRouteId_gateId_key" ON "public"."PatrolRouteGate"("patrolRouteId", "gateId");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolRouteGate_patrolRouteId_sequence_key" ON "public"."PatrolRouteGate"("patrolRouteId", "sequence");

-- AddForeignKey
ALTER TABLE "public"."PatrolRouteGate" ADD CONSTRAINT "PatrolRouteGate_patrolRouteId_fkey" FOREIGN KEY ("patrolRouteId") REFERENCES "public"."PatrolRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolRouteGate" ADD CONSTRAINT "PatrolRouteGate_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
