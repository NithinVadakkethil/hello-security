-- CreateTable
CREATE TABLE IF NOT EXISTS "Attendance" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT,
    "shiftId" TEXT,
    "assignmentId" TEXT,
    "attendanceDate" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" TEXT NOT NULL DEFAULT 'FACE_VERIFICATION',
    "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_employeeId_attendanceDate_key" ON "Attendance"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_clientId_attendanceDate_idx" ON "Attendance"("clientId", "attendanceDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_employeeId_attendanceDate_idx" ON "Attendance"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_siteId_idx" ON "Attendance"("siteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_shiftId_idx" ON "Attendance"("shiftId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attendance_clientId_fkey') THEN
        ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attendance_employeeId_fkey') THEN
        ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attendance_siteId_fkey') THEN
        ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attendance_shiftId_fkey') THEN
        ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attendance_assignmentId_fkey') THEN
        ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "GuardAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
