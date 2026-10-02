-- AlterTable Shift
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "mandatoryPatrol1Time" TEXT,
ADD COLUMN IF NOT EXISTS "mandatoryPatrol1WindowBefore" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS "mandatoryPatrol1WindowAfter" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS "mandatoryPatrol2Time" TEXT,
ADD COLUMN IF NOT EXISTS "mandatoryPatrol2WindowBefore" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS "mandatoryPatrol2WindowAfter" INTEGER NOT NULL DEFAULT 15;

-- CreateTable MandatoryPatrolInstance
CREATE TABLE IF NOT EXISTS "MandatoryPatrolInstance" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "shiftDate" DATE NOT NULL,
    "sequence" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "completedAt" TIMESTAMP(3),
    "patrolSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MandatoryPatrolInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable NotificationUserRecipient
CREATE TABLE IF NOT EXISTS "NotificationUserRecipient" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationUserRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MandatoryPatrolInstance_assignmentId_shiftDate_sequence_key" ON "MandatoryPatrolInstance"("assignmentId", "shiftDate", "sequence");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MandatoryPatrolInstance_clientId_status_idx" ON "MandatoryPatrolInstance"("clientId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MandatoryPatrolInstance_employeeId_shiftDate_idx" ON "MandatoryPatrolInstance"("employeeId", "shiftDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MandatoryPatrolInstance_windowStart_windowEnd_idx" ON "MandatoryPatrolInstance"("windowStart", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_clientId_idx" ON "Notification"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationUserRecipient_notificationId_userId_key" ON "NotificationUserRecipient"("notificationId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationUserRecipient_userId_isRead_idx" ON "NotificationUserRecipient"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "MandatoryPatrolInstance" ADD CONSTRAINT "MandatoryPatrolInstance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryPatrolInstance" ADD CONSTRAINT "MandatoryPatrolInstance_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "GuardAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryPatrolInstance" ADD CONSTRAINT "MandatoryPatrolInstance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryPatrolInstance" ADD CONSTRAINT "MandatoryPatrolInstance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatoryPatrolInstance" ADD CONSTRAINT "MandatoryPatrolInstance_patrolSessionId_fkey" FOREIGN KEY ("patrolSessionId") REFERENCES "PatrolSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationUserRecipient" ADD CONSTRAINT "NotificationUserRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationUserRecipient" ADD CONSTRAINT "NotificationUserRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
