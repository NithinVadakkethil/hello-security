-- CreateTable
CREATE TABLE "public"."PatrolRoute" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "routeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrolRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatrolCheckpoint" (
    "id" TEXT NOT NULL,
    "patrolRouteId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "expectedDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatrolRoute_routeCode_key" ON "public"."PatrolRoute"("routeCode");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolRoute_siteId_name_key" ON "public"."PatrolRoute"("siteId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolCheckpoint_patrolRouteId_sequence_key" ON "public"."PatrolCheckpoint"("patrolRouteId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolCheckpoint_patrolRouteId_gateId_key" ON "public"."PatrolCheckpoint"("patrolRouteId", "gateId");

-- AddForeignKey
ALTER TABLE "public"."PatrolRoute" ADD CONSTRAINT "PatrolRoute_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolRoute" ADD CONSTRAINT "PatrolRoute_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolCheckpoint" ADD CONSTRAINT "PatrolCheckpoint_patrolRouteId_fkey" FOREIGN KEY ("patrolRouteId") REFERENCES "public"."PatrolRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolCheckpoint" ADD CONSTRAINT "PatrolCheckpoint_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
