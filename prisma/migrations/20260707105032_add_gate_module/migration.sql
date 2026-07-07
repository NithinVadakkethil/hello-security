-- CreateTable
CREATE TABLE "public"."Gate" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "gateCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "qrCode" TEXT,
    "nfcTag" TEXT,
    "sequence" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gate_gateCode_key" ON "public"."Gate"("gateCode");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_siteId_name_key" ON "public"."Gate"("siteId", "name");

-- AddForeignKey
ALTER TABLE "public"."Gate" ADD CONSTRAINT "Gate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
