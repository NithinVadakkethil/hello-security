-- AlterTable
ALTER TABLE "Gate" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CheckpointCategory" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckpointCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CategorySubTask" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SECURITY',
    "taskName" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorySubTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Gate_categoryId_idx" ON "Gate"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CheckpointCategory_clientId_normalizedName_key" ON "CheckpointCategory"("clientId", "normalizedName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CheckpointCategory_clientId_idx" ON "CheckpointCategory"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CategorySubTask_categoryId_role_taskName_key" ON "CategorySubTask"("categoryId", "role", "taskName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CategorySubTask_categoryId_idx" ON "CategorySubTask"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CategorySubTask_role_idx" ON "CategorySubTask"("role");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Gate_categoryId_fkey'
  ) THEN
    ALTER TABLE "Gate" ADD CONSTRAINT "Gate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CheckpointCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CheckpointCategory_clientId_fkey'
  ) THEN
    ALTER TABLE "CheckpointCategory" ADD CONSTRAINT "CheckpointCategory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CategorySubTask_categoryId_fkey'
  ) THEN
    ALTER TABLE "CategorySubTask" ADD CONSTRAINT "CategorySubTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CheckpointCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
