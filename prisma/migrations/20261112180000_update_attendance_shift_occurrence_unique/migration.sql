-- Migration: Update Attendance unique constraint for shift occurrence support
-- Drops single-record-per-day constraint and establishes shift-aware indexing

-- 1. Drop the legacy calendar-day unique index
DROP INDEX IF EXISTS "Attendance_employeeId_attendanceDate_key";

-- 2. Create shift-aware unique index allowing distinct shifts on the same business date
-- Unassigned check-ins coalesce to 'UNASSIGNED' to preserve single unassigned attendance per business date
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_employeeId_shiftId_attendanceDate_key" 
ON "Attendance"("employeeId", COALESCE("shiftId", 'UNASSIGNED'), "attendanceDate");

-- 3. Add supporting index for active in-progress attendance resolution across midnight
CREATE INDEX IF NOT EXISTS "Attendance_employeeId_checkInAt_checkOutAt_idx" 
ON "Attendance"("employeeId", "checkInAt", "checkOutAt");

