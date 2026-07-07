/*
  Warnings:

  - A unique constraint covering the columns `[clientCode]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clientCode` to the `Client` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "clientCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientCode_key" ON "public"."Client"("clientCode");
