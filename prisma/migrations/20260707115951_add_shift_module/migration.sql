-- CreateTable
CREATE TABLE "public"."Shift" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "shiftCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shift_shiftCode_key" ON "public"."Shift"("shiftCode");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_clientId_name_key" ON "public"."Shift"("clientId", "name");

-- AddForeignKey
ALTER TABLE "public"."Shift" ADD CONSTRAINT "Shift_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
