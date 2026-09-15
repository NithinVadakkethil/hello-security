-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER', 'SUPERVISOR', 'SECURITY', 'CLEANER', 'SERVICE_ENGINEER', 'TECHNICIAN', 'LIFE_GUARD', 'PLUMBER');

-- CreateEnum
CREATE TYPE "public"."EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."IdentificationMethod" AS ENUM ('QR', 'RFID');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'DOWNLOAD');

-- CreateEnum
CREATE TYPE "public"."PatrolStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'NOT_VERIFIED');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "authorizedPerson" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "subscriptionStatus" "public"."SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "identificationMethod" "public"."IdentificationMethod" NOT NULL DEFAULT 'QR',
    "maxEmployees" INTEGER NOT NULL DEFAULT 50,
    "maxCheckpoints" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clientLogoUrl" TEXT,
    "dashboardImageUrl" TEXT,
    "dashboardImageAspectRatio" DOUBLE PRECISION,
    "dashboardImageOrientation" TEXT DEFAULT 'LANDSCAPE',
    "dashboardImageFocalPosition" TEXT DEFAULT 'center',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "employeeId" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rawPassword" TEXT,
    "role" "public"."UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Employee" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "photo" TEXT,
    "designation" TEXT,
    "joiningDate" TIMESTAMP(3),
    "identificationMethod" "public"."IdentificationMethod" NOT NULL DEFAULT 'QR',
    "qrCode" TEXT,
    "rfidTag" TEXT,
    "status" "public"."EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" "public"."UserRole" NOT NULL DEFAULT 'SECURITY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Site" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radius" INTEGER NOT NULL DEFAULT 100,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Gate" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "gateCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sequence" INTEGER NOT NULL,
    "qrCode" TEXT,
    "nfcTag" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."GuardAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL DEFAULT 'ROUTE',
    "patrolRouteId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuardAssignmentGate" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardAssignmentGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatrolRoute" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "routeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrolRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatrolRouteGate" (
    "id" TEXT NOT NULL,
    "patrolRouteId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "expectedDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolRouteGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatrolCheckpoint" (
    "id" TEXT NOT NULL,
    "patrolSessionId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "remarks" TEXT,
    "status" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatrolSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "managerUserId" TEXT,
    "patrolCode" TEXT NOT NULL,
    "status" "public"."PatrolStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "pauseCount" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" INTEGER,
    "remarks" TEXT,
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verificationTime" TIMESTAMP(3),
    "supervisorRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrolSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceInfo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "userId" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Counter" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "clientId" TEXT NOT NULL DEFAULT 'GLOBAL',
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Incident" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "patrolSessionId" TEXT,
    "gateId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GateSubTask" (
    "id" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'SECURITY',
    "taskName" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceMasterItemId" TEXT,

    CONSTRAINT "GateSubTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubTaskMaster" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'SECURITY',
    "name" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubTaskMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubTaskMasterItem" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubTaskMasterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatrolSubTaskResponse" (
    "id" TEXT NOT NULL,
    "patrolCheckpointId" TEXT NOT NULL,
    "gateSubTaskId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "remarks" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrolSubTaskResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SnagCategory" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SnagCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SnagSubCategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SnagSubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Snag" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "gateId" TEXT,
    "patrolSessionId" TEXT,
    "employeeId" TEXT NOT NULL,
    "categoryId" TEXT,
    "subCategoryId" TEXT,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Snag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SnagComment" (
    "id" TEXT NOT NULL,
    "snagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnagComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SnagHistory" (
    "id" TEXT NOT NULL,
    "snagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnagHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SnagAssignment" (
    "id" TEXT NOT NULL,
    "snagId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientNotificationSettings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "patrolCompletedEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientNotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationRecipient" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GLOBAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationDelivery" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "patrolSessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PATROL_COMPLETED',
    "recipient" TEXT NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ManagerClientMembership" (
    "id" TEXT NOT NULL,
    "managerUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerClientMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientCode_key" ON "public"."Client"("clientCode");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "public"."Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "public"."User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_clientId_employeeNumber_key" ON "public"."Employee"("clientId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Site_clientId_name_key" ON "public"."Site"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Site_clientId_siteCode_key" ON "public"."Site"("clientId", "siteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_siteId_name_key" ON "public"."Gate"("siteId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_siteId_gateCode_key" ON "public"."Gate"("siteId", "gateCode");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_clientId_name_key" ON "public"."Shift"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_clientId_shiftCode_key" ON "public"."Shift"("clientId", "shiftCode");

-- CreateIndex
CREATE INDEX "GuardAssignment_employeeId_idx" ON "public"."GuardAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "GuardAssignment_siteId_idx" ON "public"."GuardAssignment"("siteId");

-- CreateIndex
CREATE INDEX "GuardAssignment_shiftId_idx" ON "public"."GuardAssignment"("shiftId");

-- CreateIndex
CREATE INDEX "GuardAssignment_patrolRouteId_idx" ON "public"."GuardAssignment"("patrolRouteId");

-- CreateIndex
CREATE INDEX "GuardAssignmentGate_assignmentId_idx" ON "public"."GuardAssignmentGate"("assignmentId");

-- CreateIndex
CREATE INDEX "GuardAssignmentGate_gateId_idx" ON "public"."GuardAssignmentGate"("gateId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardAssignmentGate_assignmentId_gateId_key" ON "public"."GuardAssignmentGate"("assignmentId", "gateId");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolRoute_siteId_name_key" ON "public"."PatrolRoute"("siteId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolRoute_clientId_routeCode_key" ON "public"."PatrolRoute"("clientId", "routeCode");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolRouteGate_patrolRouteId_gateId_key" ON "public"."PatrolRouteGate"("patrolRouteId", "gateId");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolRouteGate_patrolRouteId_sequence_key" ON "public"."PatrolRouteGate"("patrolRouteId", "sequence");

-- CreateIndex
CREATE INDEX "PatrolCheckpoint_patrolSessionId_idx" ON "public"."PatrolCheckpoint"("patrolSessionId");

-- CreateIndex
CREATE INDEX "PatrolCheckpoint_gateId_idx" ON "public"."PatrolCheckpoint"("gateId");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolSession_clientId_patrolCode_key" ON "public"."PatrolSession"("clientId", "patrolCode");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_deviceId_idx" ON "public"."RefreshToken"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_entity_clientId_key" ON "public"."Counter"("entity", "clientId");

-- CreateIndex
CREATE INDEX "Incident_clientId_idx" ON "public"."Incident"("clientId");

-- CreateIndex
CREATE INDEX "Incident_employeeId_idx" ON "public"."Incident"("employeeId");

-- CreateIndex
CREATE INDEX "GateSubTask_gateId_idx" ON "public"."GateSubTask"("gateId");

-- CreateIndex
CREATE INDEX "GateSubTask_role_idx" ON "public"."GateSubTask"("role");

-- CreateIndex
CREATE INDEX "GateSubTask_sourceMasterItemId_idx" ON "public"."GateSubTask"("sourceMasterItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GateSubTask_gateId_role_taskName_key" ON "public"."GateSubTask"("gateId", "role", "taskName");

-- CreateIndex
CREATE INDEX "SubTaskMaster_clientId_idx" ON "public"."SubTaskMaster"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SubTaskMaster_clientId_role_key" ON "public"."SubTaskMaster"("clientId", "role");

-- CreateIndex
CREATE INDEX "SubTaskMasterItem_masterId_idx" ON "public"."SubTaskMasterItem"("masterId");

-- CreateIndex
CREATE UNIQUE INDEX "SubTaskMasterItem_masterId_taskName_key" ON "public"."SubTaskMasterItem"("masterId", "taskName");

-- CreateIndex
CREATE INDEX "PatrolSubTaskResponse_patrolCheckpointId_idx" ON "public"."PatrolSubTaskResponse"("patrolCheckpointId");

-- CreateIndex
CREATE INDEX "PatrolSubTaskResponse_gateSubTaskId_idx" ON "public"."PatrolSubTaskResponse"("gateSubTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolSubTaskResponse_patrolCheckpointId_gateSubTaskId_key" ON "public"."PatrolSubTaskResponse"("patrolCheckpointId", "gateSubTaskId");

-- CreateIndex
CREATE INDEX "SnagCategory_clientId_idx" ON "public"."SnagCategory"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SnagCategory_clientId_name_key" ON "public"."SnagCategory"("clientId", "name");

-- CreateIndex
CREATE INDEX "SnagSubCategory_categoryId_idx" ON "public"."SnagSubCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SnagSubCategory_categoryId_name_key" ON "public"."SnagSubCategory"("categoryId", "name");

-- CreateIndex
CREATE INDEX "Snag_clientId_idx" ON "public"."Snag"("clientId");

-- CreateIndex
CREATE INDEX "Snag_siteId_idx" ON "public"."Snag"("siteId");

-- CreateIndex
CREATE INDEX "Snag_employeeId_idx" ON "public"."Snag"("employeeId");

-- CreateIndex
CREATE INDEX "Snag_patrolSessionId_idx" ON "public"."Snag"("patrolSessionId");

-- CreateIndex
CREATE INDEX "SnagComment_snagId_idx" ON "public"."SnagComment"("snagId");

-- CreateIndex
CREATE INDEX "SnagComment_userId_idx" ON "public"."SnagComment"("userId");

-- CreateIndex
CREATE INDEX "SnagHistory_snagId_idx" ON "public"."SnagHistory"("snagId");

-- CreateIndex
CREATE INDEX "SnagHistory_userId_idx" ON "public"."SnagHistory"("userId");

-- CreateIndex
CREATE INDEX "SnagAssignment_snagId_idx" ON "public"."SnagAssignment"("snagId");

-- CreateIndex
CREATE INDEX "SnagAssignment_assignedToId_idx" ON "public"."SnagAssignment"("assignedToId");

-- CreateIndex
CREATE INDEX "SnagAssignment_assignedById_idx" ON "public"."SnagAssignment"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "ClientNotificationSettings_clientId_key" ON "public"."ClientNotificationSettings"("clientId");

-- CreateIndex
CREATE INDEX "ClientNotificationSettings_clientId_idx" ON "public"."ClientNotificationSettings"("clientId");

-- CreateIndex
CREATE INDEX "NotificationRecipient_settingsId_idx" ON "public"."NotificationRecipient"("settingsId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_settingsId_email_role_key" ON "public"."NotificationRecipient"("settingsId", "email", "role");

-- CreateIndex
CREATE INDEX "NotificationDelivery_clientId_idx" ON "public"."NotificationDelivery"("clientId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_patrolSessionId_idx" ON "public"."NotificationDelivery"("patrolSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_type_patrolSessionId_recipient_key" ON "public"."NotificationDelivery"("type", "patrolSessionId", "recipient");

-- CreateIndex
CREATE INDEX "ManagerClientMembership_managerUserId_idx" ON "public"."ManagerClientMembership"("managerUserId");

-- CreateIndex
CREATE INDEX "ManagerClientMembership_clientId_idx" ON "public"."ManagerClientMembership"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerClientMembership_managerUserId_clientId_key" ON "public"."ManagerClientMembership"("managerUserId", "clientId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Site" ADD CONSTRAINT "Site_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Gate" ADD CONSTRAINT "Gate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Shift" ADD CONSTRAINT "Shift_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignment" ADD CONSTRAINT "GuardAssignment_patrolRouteId_fkey" FOREIGN KEY ("patrolRouteId") REFERENCES "public"."PatrolRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignmentGate" ADD CONSTRAINT "GuardAssignmentGate_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."GuardAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAssignmentGate" ADD CONSTRAINT "GuardAssignmentGate_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolRoute" ADD CONSTRAINT "PatrolRoute_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolRoute" ADD CONSTRAINT "PatrolRoute_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolRouteGate" ADD CONSTRAINT "PatrolRouteGate_patrolRouteId_fkey" FOREIGN KEY ("patrolRouteId") REFERENCES "public"."PatrolRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolRouteGate" ADD CONSTRAINT "PatrolRouteGate_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolCheckpoint" ADD CONSTRAINT "PatrolCheckpoint_patrolSessionId_fkey" FOREIGN KEY ("patrolSessionId") REFERENCES "public"."PatrolSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolCheckpoint" ADD CONSTRAINT "PatrolCheckpoint_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolSession" ADD CONSTRAINT "PatrolSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolSession" ADD CONSTRAINT "PatrolSession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."GuardAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolSession" ADD CONSTRAINT "PatrolSession_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolSession" ADD CONSTRAINT "PatrolSession_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_patrolSessionId_fkey" FOREIGN KEY ("patrolSessionId") REFERENCES "public"."PatrolSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GateSubTask" ADD CONSTRAINT "GateSubTask_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GateSubTask" ADD CONSTRAINT "GateSubTask_sourceMasterItemId_fkey" FOREIGN KEY ("sourceMasterItemId") REFERENCES "public"."SubTaskMasterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubTaskMaster" ADD CONSTRAINT "SubTaskMaster_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubTaskMasterItem" ADD CONSTRAINT "SubTaskMasterItem_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."SubTaskMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolSubTaskResponse" ADD CONSTRAINT "PatrolSubTaskResponse_patrolCheckpointId_fkey" FOREIGN KEY ("patrolCheckpointId") REFERENCES "public"."PatrolCheckpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatrolSubTaskResponse" ADD CONSTRAINT "PatrolSubTaskResponse_gateSubTaskId_fkey" FOREIGN KEY ("gateSubTaskId") REFERENCES "public"."GateSubTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnagCategory" ADD CONSTRAINT "SnagCategory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnagSubCategory" ADD CONSTRAINT "SnagSubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."SnagCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Snag" ADD CONSTRAINT "Snag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Snag" ADD CONSTRAINT "Snag_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Snag" ADD CONSTRAINT "Snag_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Snag" ADD CONSTRAINT "Snag_patrolSessionId_fkey" FOREIGN KEY ("patrolSessionId") REFERENCES "public"."PatrolSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Snag" ADD CONSTRAINT "Snag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Snag" ADD CONSTRAINT "Snag_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."SnagCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Snag" ADD CONSTRAINT "Snag_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "public"."SnagSubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnagComment" ADD CONSTRAINT "SnagComment_snagId_fkey" FOREIGN KEY ("snagId") REFERENCES "public"."Snag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnagComment" ADD CONSTRAINT "SnagComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnagHistory" ADD CONSTRAINT "SnagHistory_snagId_fkey" FOREIGN KEY ("snagId") REFERENCES "public"."Snag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnagHistory" ADD CONSTRAINT "SnagHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnagAssignment" ADD CONSTRAINT "SnagAssignment_snagId_fkey" FOREIGN KEY ("snagId") REFERENCES "public"."Snag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnagAssignment" ADD CONSTRAINT "SnagAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SnagAssignment" ADD CONSTRAINT "SnagAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientNotificationSettings" ADD CONSTRAINT "ClientNotificationSettings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "public"."ClientNotificationSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ManagerClientMembership" ADD CONSTRAINT "ManagerClientMembership_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ManagerClientMembership" ADD CONSTRAINT "ManagerClientMembership_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

