-- CreateTable
CREATE TABLE "public"."GuardAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardAssignment_employeeId_idx" ON "public"."GuardAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "GuardAssignment_siteId_idx" ON "public"."GuardAssignment"("siteId");

-- CreateIndex
CREATE INDEX "GuardAssignment_shiftId_idx" ON "public"."GuardAssignment"("shiftId");

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
