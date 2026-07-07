/*
  Warnings:

  - A unique constraint covering the columns `[siteCode]` on the table `Site` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clientId,name]` on the table `Site` will be added. If there are existing duplicate values, this will fail.
  - Made the column `radius` on table `Site` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."Site_clientId_siteCode_key";

-- AlterTable
ALTER TABLE "public"."Site" ALTER COLUMN "radius" SET NOT NULL,
ALTER COLUMN "radius" SET DEFAULT 100;

-- CreateIndex
CREATE UNIQUE INDEX "Site_siteCode_key" ON "public"."Site"("siteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Site_clientId_name_key" ON "public"."Site"("clientId", "name");
