-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_clientId_fkey";

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "clientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
