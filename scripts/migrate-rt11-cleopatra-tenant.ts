#!/usr/bin/env tsx
/**
 * Idempotent, Transaction-Wrapped Production Tenant Separation Script:
 * Transfers RT 11 - Cleopatra Tower (SITE-000002 / cmsya0knf000ohp6t7e2qselw)
 * and its exclusive resources from KAIZEN - Herculas (cmspzj3lz0054hp189gaym6ky)
 * into a new independent Client & Client Admin (ct.kaizen@helloorbit.com),
 * while leaving RT-10 Hercules Tower (SITE-000001) and all physical QR codes
 * (Gate.id, Gate.gateCode, Gate.qrCode) completely intact.
 *
 * Modes:
 *   --dry-run   (default) Read-only analysis & plan output; makes zero writes.
 *   --execute   Executes the separation inside a single ACID transaction.
 *   --verify    Runs post-migration isolation & integrity verification only.
 */

import { createHash, randomBytes } from 'crypto';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@prisma/client';

const SOURCE_CLIENT_ID = 'cmspzj3lz0054hp189gaym6ky';
const SOURCE_ADMIN_EMAIL = 'kaizen.legend@helloorbit.com';
const EXISTING_UNRELATED_CLEOPATRA_CLIENT_ID = 'cmul1dyji0kbdhpr884kvsfus';

const RT10_SITE_ID = 'cmsq074j2005jhp18vyzarosu';
const RT11_SITE_ID = 'cmsya0knf000ohp6t7e2qselw';

const NEW_ADMIN_EMAIL = 'ct.kaizen@helloorbit.com';
const DEFAULT_NEW_COMPANY_NAME = 'KAIZEN - RT 11 Cleopatra Tower';
const EXCLUSIVE_EMPLOYEE_EMAIL_DOMAIN = '@ct.com';

interface CliOptions {
  mode: 'dry-run' | 'execute' | 'verify';
  companyName: string;
  grantManagerMemberships: boolean;
  pruneNonMemberNotificationRecipients: boolean;
  confirmProduction: boolean;
  jsonReportPath?: string;
  credentialsOutPath?: string;
}

function parseArgs(argv: string[]): CliOptions {
  let mode: 'dry-run' | 'execute' | 'verify' = 'dry-run';
  let companyName = DEFAULT_NEW_COMPANY_NAME;
  let grantManagerMemberships = false;
  let pruneNonMemberNotificationRecipients = true;
  let confirmProduction = false;
  let jsonReportPath: string | undefined;
  let credentialsOutPath: string | undefined;

  for (const arg of argv) {
    if (arg === '--dry-run') mode = 'dry-run';
    else if (arg === '--execute') mode = 'execute';
    else if (arg === '--verify') mode = 'verify';
    else if (arg === '--confirm-production') confirmProduction = true;
    else if (arg === '--grant-manager-memberships=true' || arg === '--grant-manager-memberships') {
      grantManagerMemberships = true;
    } else if (arg === '--grant-manager-memberships=false') {
      grantManagerMemberships = false;
    } else if (arg === '--prune-nonmember-notification-recipients=false') {
      pruneNonMemberNotificationRecipients = false;
    } else if (arg.startsWith('--company-name=')) {
      companyName = arg.slice('--company-name='.length).trim();
    } else if (arg.startsWith('--json-report=')) {
      jsonReportPath = arg.slice('--json-report='.length).trim();
    } else if (arg.startsWith('--credentials-out=')) {
      credentialsOutPath = arg.slice('--credentials-out='.length).trim();
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: tsx scripts/migrate-rt11-cleopatra-tenant.ts [options]
  --dry-run                              Read-only preflight and planned migration summary (default)
  --execute                              Run full separation inside an ACID transaction
  --verify                               Run post-migration verification checks only
  --company-name="<name>"                Approved companyName for new tenant (default: "${DEFAULT_NEW_COMPANY_NAME}")
  --grant-manager-memberships=true|false Clone existing regional ManagerClientMemberships (default: false)
  --json-report=<path>                   Write structured JSON verification report
  --credentials-out=<path>               Write newly provisioned admin temporary password to file (0600)
  --confirm-production                   Required safety acknowledgement if DATABASE_URL targets production/live host`);
      process.exit(0);
    } else {
      throw new Error(`Unknown CLI flag: ${arg}`);
    }
  }

  if (!companyName) {
    throw new Error('--company-name must not be empty');
  }

  return {
    mode,
    companyName,
    grantManagerMemberships,
    pruneNonMemberNotificationRecipients,
    confirmProduction,
    jsonReportPath,
    credentialsOutPath,
  };
}

function assertSafeTargetDatabase(opts: CliOptions) {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  const parsed = new URL(dbUrl);
  const host = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, '');
  const looksLikeProduction =
    host === '194.76.27.3' ||
    ((dbName === 'orbitdb' || dbName === 'demoorbitdb') &&
      !host.includes('localhost') &&
      !host.includes('127.0.0.1'));

  if (opts.mode === 'execute' && looksLikeProduction && !opts.confirmProduction) {
    throw new Error(
      `Refusing --execute against non-local/live database (${host}/${dbName}) without explicit --confirm-production flag.`,
    );
  }
}

function extractCodeSequence(code: string | null | undefined): number {
  if (!code) return 0;
  const match = code.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function formatClientCode(sequence: number): string {
  return `CLIENT-${sequence.toString().padStart(6, '0')}`;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function captureRt10Snapshot(db: PrismaClient | Prisma.TransactionClient) {
  const site = await db.site.findUnique({
    where: { id: RT10_SITE_ID },
    select: { id: true, clientId: true, siteCode: true, name: true, isActive: true },
  });
  const gates = await db.gate.findMany({
    where: { siteId: RT10_SITE_ID },
    orderBy: { id: 'asc' },
    select: { id: true, siteId: true, gateCode: true, name: true, qrCode: true, isActive: true, sequence: true },
  });
  const gateSubTasks = await db.gateSubTask.count({
    where: { gate: { siteId: RT10_SITE_ID } },
  });
  const routes = await db.patrolRoute.findMany({
    where: { siteId: RT10_SITE_ID },
    orderBy: { id: 'asc' },
    select: { id: true, clientId: true, routeCode: true, isActive: true },
  });
  const assignments = await db.guardAssignment.findMany({
    where: { siteId: RT10_SITE_ID },
    orderBy: { id: 'asc' },
    select: { id: true, clientId: true, employeeId: true, shiftId: true, isActive: true },
  });
  const assignmentGates = await db.guardAssignmentGate.count({
    where: { assignment: { siteId: RT10_SITE_ID } },
  });
  const patrolSessions = await db.patrolSession.count({
    where: { assignment: { siteId: RT10_SITE_ID } },
  });
  const patrolCheckpoints = await db.patrolCheckpoint.count({
    where: { gate: { siteId: RT10_SITE_ID } },
  });
  const subTaskResponses = await db.patrolSubTaskResponse.count({
    where: { patrolCheckpoint: { gate: { siteId: RT10_SITE_ID } } },
  });
  const incidents = await db.incident.count({
    where: { clientId: SOURCE_CLIENT_ID, NOT: { OR: [{ gate: { siteId: RT11_SITE_ID } }, { employee: { email: { endsWith: EXCLUSIVE_EMPLOYEE_EMAIL_DOMAIN, mode: 'insensitive' } } }] } },
  });
  const snags = await db.snag.count({ where: { clientId: SOURCE_CLIENT_ID } });
  const unrelatedCleopatra = await db.client.findUnique({
    where: { id: EXISTING_UNRELATED_CLEOPATRA_CLIENT_ID },
    select: { id: true, clientCode: true, companyName: true, email: true, isActive: true },
  });

  const digest = sha256({
    site,
    gates,
    gateSubTasks,
    routes,
    assignments,
    assignmentGates,
    patrolSessions,
    patrolCheckpoints,
    subTaskResponses,
    incidents,
    snags,
    unrelatedCleopatra,
  });

  return {
    digest,
    counts: {
      siteActive: site?.isActive ?? null,
      siteClientId: site?.clientId ?? null,
      gates: gates.length,
      gateSubTasks,
      routes: routes.length,
      assignments: assignments.length,
      assignmentGates,
      patrolSessions,
      patrolCheckpoints,
      subTaskResponses,
      incidents,
      snags,
    },
  };
}

async function captureRt11QrSignature(db: PrismaClient | Prisma.TransactionClient) {
  const gates = await db.gate.findMany({
    where: { siteId: RT11_SITE_ID },
    orderBy: { id: 'asc' },
    select: { id: true, siteId: true, gateCode: true, qrCode: true, nfcTag: true, name: true, sequence: true, isActive: true },
  });
  const gateSubTaskIds = await db.gateSubTask.findMany({
    where: { gate: { siteId: RT11_SITE_ID } },
    orderBy: { id: 'asc' },
    select: { id: true, gateId: true, role: true, taskName: true, isActive: true },
  });
  return {
    gateCount: gates.length,
    gateSubTaskCount: gateSubTaskIds.length,
    digest: sha256({ gates, gateSubTaskIds }),
  };
}

async function discoverScope(db: PrismaClient | Prisma.TransactionClient) {
  const sourceClient = await db.client.findUnique({ where: { id: SOURCE_CLIENT_ID } });
  if (!sourceClient) {
    throw new Error(`Source client ${SOURCE_CLIENT_ID} not found.`);
  }

  const rt10Site = await db.site.findUnique({ where: { id: RT10_SITE_ID } });
  const rt11Site = await db.site.findUnique({ where: { id: RT11_SITE_ID } });
  if (!rt10Site || !rt11Site) {
    throw new Error('Expected RT-10 and/or RT-11 site record missing.');
  }

  const newAdminUser = await db.user.findUnique({ where: { email: NEW_ADMIN_EMAIL } });
  const newClientByEmail = await db.client.findUnique({ where: { email: NEW_ADMIN_EMAIL } });

  const migratedState: 'PENDING' | 'ALREADY_MIGRATED' =
    rt11Site.clientId === SOURCE_CLIENT_ID && !newAdminUser && !newClientByEmail
      ? 'PENDING'
      : rt11Site.clientId !== SOURCE_CLIENT_ID &&
          newAdminUser?.clientId === rt11Site.clientId &&
          newClientByEmail?.id === rt11Site.clientId
        ? 'ALREADY_MIGRATED'
        : (() => {
            throw new Error(
              `Inconsistent migration state detected: rt11Site.clientId=${rt11Site.clientId}, newAdminUser.clientId=${newAdminUser?.clientId}, newClientByEmail.id=${newClientByEmail?.id}`,
            );
          })();

  // Identify RT-11 exclusive employees (@ct.com) + verify ZERO overlap with RT-10
  const ctEmployees = await db.employee.findMany({
    where: {
      email: { endsWith: EXCLUSIVE_EMPLOYEE_EMAIL_DOMAIN, mode: 'insensitive' },
      clientId: migratedState === 'PENDING' ? SOURCE_CLIENT_ID : rt11Site.clientId,
    },
    include: { user: true },
    orderBy: { employeeNumber: 'asc' },
  });
  const ctEmployeeIds = ctEmployees.map((e) => e.id);
  const ctUserIds = ctEmployees.map((e) => e.user?.id).filter((id): id is string => Boolean(id));

  // Hard invariant checks for zero RT-10 overlap
  const rt11AssignmentsOnNonCt = await db.guardAssignment.count({
    where: { siteId: RT11_SITE_ID, employeeId: { notIn: ctEmployeeIds } },
  });
  const rt10AssignmentsOnCt = await db.guardAssignment.count({
    where: { siteId: RT10_SITE_ID, employeeId: { in: ctEmployeeIds } },
  });
  const rt10SessionsOnCt = await db.patrolSession.count({
    where: {
      OR: [
        { assignment: { employeeId: { in: ctEmployeeIds }, siteId: { not: RT11_SITE_ID } } },
        {
          assignment: { employeeId: { in: ctEmployeeIds } },
          checkpoints: { some: { gate: { siteId: { not: RT11_SITE_ID } } } },
        },
      ],
    },
  });
  const rt10IncidentsOnCt = await db.incident.count({
    where: {
      employeeId: { in: ctEmployeeIds },
      OR: [{ gate: { siteId: RT10_SITE_ID } }, { patrolSession: { assignment: { siteId: RT10_SITE_ID } } }],
    },
  });

  if (rt11AssignmentsOnNonCt > 0 || rt10AssignmentsOnCt > 0 || rt10SessionsOnCt > 0 || rt10IncidentsOnCt > 0) {
    throw new Error(
      `Cross-site employee overlap detected! rt11AssignmentsOnNonCt=${rt11AssignmentsOnNonCt}, rt10AssignmentsOnCt=${rt10AssignmentsOnCt}, rt10SessionsOnCt=${rt10SessionsOnCt}, rt10IncidentsOnCt=${rt10IncidentsOnCt}`,
    );
  }

  const rt11Gates = await db.gate.findMany({ where: { siteId: RT11_SITE_ID }, select: { id: true, categoryId: true } });
  const rt11GateIds = rt11Gates.map((g) => g.id);

  if (rt11Gates.some((g) => g.categoryId !== null)) {
    throw new Error('Unexpected non-null Gate.categoryId found on RT-11 gates.');
  }

  const rt11Routes = await db.patrolRoute.findMany({
    where: { siteId: RT11_SITE_ID },
    select: { id: true, routeCode: true, isActive: true },
  });
  const rt11Assignments = await db.guardAssignment.findMany({
    where: { siteId: RT11_SITE_ID },
    select: { id: true, shiftId: true, employeeId: true, isActive: true, patrolRouteId: true },
  });

  const rt11Sessions = await db.patrolSession.findMany({
    where: {
      OR: [
        { assignment: { siteId: RT11_SITE_ID } },
        { checkpoints: { some: { gateId: { in: rt11GateIds } } } },
      ],
    },
    select: { id: true, clientId: true, patrolCode: true, assignmentId: true },
  });
  const rt11SessionIds = rt11Sessions.map((s) => s.id);

  // Verify none of the RT-11 sessions also touched an RT-10 gate
  const crossSiteCheckpoints = await db.patrolCheckpoint.count({
    where: {
      patrolSessionId: { in: rt11SessionIds },
      gate: { siteId: { not: RT11_SITE_ID } },
    },
  });
  if (crossSiteCheckpoints > 0) {
    throw new Error(`Found ${crossSiteCheckpoints} cross-site checkpoints in RT-11 patrol sessions!`);
  }

  // Shared Shifts used by RT-11 assignments
  const usedShiftIds = Array.from(new Set(rt11Assignments.map((a) => a.shiftId)));
  const sharedShifts = await db.shift.findMany({
    where: { id: { in: usedShiftIds } },
    orderBy: { shiftCode: 'asc' },
  });

  // SubTaskMaster items referenced by RT-11 GateSubTasks
  const rt11LinkedMasterItems = await db.gateSubTask.findMany({
    where: { gate: { siteId: RT11_SITE_ID }, sourceMasterItemId: { not: null } },
    select: { id: true, sourceMasterItemId: true, sourceMasterItem: { select: { masterId: true } } },
  });
  const masterIdsToClone = Array.from(
    new Set(
      rt11LinkedMasterItems
        .map((x) => x.sourceMasterItem?.masterId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const sharedMasters = await db.subTaskMaster.findMany({
    where: { id: { in: masterIdsToClone } },
    include: { items: { orderBy: { displayOrder: 'asc' } } },
  });

  // Incidents on RT-11
  const rt11Incidents = await db.incident.findMany({
    where: {
      OR: [
        { patrolSessionId: { in: rt11SessionIds } },
        { gateId: { in: rt11GateIds } },
        { employeeId: { in: ctEmployeeIds } },
      ],
    },
    select: { id: true, clientId: true },
  });

  // Notifications on RT-11 (by entityId matching RT-11 PatrolSessions or metadata siteId matching RT-11)
  const rt11Notifications = await db.$queryRaw<Array<{ id: string; clientId: string }>>`
    SELECT n.id, n."clientId"
    FROM "Notification" n
    WHERE (n."entityType" = 'PatrolSession' AND n."entityId" IN (${Prisma.join(rt11SessionIds.length > 0 ? rt11SessionIds : ['__none__'])}))
       OR (n.metadata->>'siteId' = ${RT11_SITE_ID})
  `;
  const rt11NotificationIds = rt11Notifications.map((n) => n.id);

  // NotificationDelivery on RT-11
  const rt11Deliveries = await db.notificationDelivery.findMany({
    where: {
      OR: [
        { patrolSessionId: { in: rt11SessionIds } },
        { patrolSessionId: { contains: RT11_SITE_ID } },
      ],
    },
    select: { id: true, clientId: true },
  });

  // RefreshTokens on migrated users
  const ctRefreshTokens = await db.refreshToken.findMany({
    where: { userId: { in: ctUserIds } },
    select: { id: true, userId: true, clientId: true, revokedAt: true },
  });

  // Existing ManagerClientMemberships on sourceClient
  const sourceManagerMemberships = await db.managerClientMembership.findMany({
    where: { clientId: SOURCE_CLIENT_ID, isActive: true },
    include: { managerUser: { select: { id: true, email: true } } },
  });

  return {
    migratedState,
    sourceClient,
    rt10Site,
    rt11Site,
    newAdminUser,
    newClientByEmail,
    ctEmployees,
    ctEmployeeIds,
    ctUserIds,
    rt11GateIds,
    rt11Routes,
    rt11Assignments,
    rt11Sessions,
    rt11SessionIds,
    sharedShifts,
    rt11LinkedMasterItems,
    sharedMasters,
    rt11Incidents,
    rt11Notifications,
    rt11NotificationIds,
    rt11Deliveries,
    ctRefreshTokens,
    sourceManagerMemberships,
  };
}

async function verifyPostMigration(
  db: PrismaClient | Prisma.TransactionClient,
  newClientId: string,
  opts: CliOptions,
  preRt10Digest?: string,
  preRt11QrDigest?: string,
) {
  const newClient = await db.client.findUnique({ where: { id: newClientId } });
  const newAdmin = await db.user.findUnique({ where: { email: NEW_ADMIN_EMAIL } });
  const rt11Site = await db.site.findUnique({ where: { id: RT11_SITE_ID } });
  const rt10Site = await db.site.findUnique({ where: { id: RT10_SITE_ID } });

  if (!newClient || !newAdmin || !rt11Site || !rt10Site) {
    throw new Error('Verification failed: missing core Client/User/Site rows.');
  }

  const assertions: Record<string, boolean | number | string> = {};

  // 1. Site separation & status preservation
  assertions.rt10RemainsUnderSourceClient = rt10Site.clientId === SOURCE_CLIENT_ID;
  assertions.rt10RemainsActive = rt10Site.isActive === true;
  assertions.rt11MovedToNewClient = rt11Site.clientId === newClientId;
  assertions.rt11PreservesInactiveStatus = rt11Site.isActive === false;
  assertions.newAdminBoundToNewClient = newAdmin.clientId === newClientId && newAdmin.role === 'CLIENT_ADMIN';

  // 2. Check zero cross-tenant FK links
  const crossRoutes = await db.patrolRoute.count({
    where: {
      OR: [
        { siteId: RT11_SITE_ID, clientId: { not: newClientId } },
        { siteId: RT10_SITE_ID, clientId: { not: SOURCE_CLIENT_ID } },
      ],
    },
  });
  const crossAssigns = await db.guardAssignment.count({
    where: {
      OR: [
        { siteId: RT11_SITE_ID, clientId: { not: newClientId } },
        { siteId: RT10_SITE_ID, clientId: { not: SOURCE_CLIENT_ID } },
        { clientId: newClientId, shift: { clientId: { not: newClientId } } },
        { clientId: SOURCE_CLIENT_ID, shift: { clientId: { not: SOURCE_CLIENT_ID } } },
        { clientId: newClientId, employee: { clientId: { not: newClientId } } },
        { clientId: SOURCE_CLIENT_ID, employee: { clientId: { not: SOURCE_CLIENT_ID } } },
        { clientId: newClientId, patrolRoute: { clientId: { not: newClientId } } },
        { clientId: SOURCE_CLIENT_ID, patrolRoute: { clientId: { not: SOURCE_CLIENT_ID } } },
      ],
    },
  });
  const crossSessions = await db.patrolSession.count({
    where: {
      OR: [
        { assignment: { siteId: RT11_SITE_ID }, clientId: { not: newClientId } },
        { assignment: { siteId: RT10_SITE_ID }, clientId: { not: SOURCE_CLIENT_ID } },
        { checkpoints: { some: { gate: { siteId: RT11_SITE_ID } } }, clientId: { not: newClientId } },
        { checkpoints: { some: { gate: { siteId: RT10_SITE_ID } } }, clientId: newClientId },
      ],
    },
  });
  // Unrelated historical third-party tenant session (e.g. Peninsula 1 2026-08-30 unscoped QR scan) is reported separately without mutating unrelated clients.
  const historicalThirdPartyRt10Sessions = await db.patrolSession.count({
    where: {
      checkpoints: { some: { gate: { siteId: RT10_SITE_ID } } },
      clientId: { notIn: [SOURCE_CLIENT_ID, newClientId] },
    },
  });
  const crossMasterLinks = await db.gateSubTask.count({
    where: {
      OR: [
        { gate: { siteId: RT11_SITE_ID }, sourceMasterItem: { master: { clientId: { not: newClientId } } } },
        { gate: { siteId: RT10_SITE_ID }, sourceMasterItem: { master: { clientId: { not: SOURCE_CLIENT_ID } } } },
      ],
    },
  });
  const userEmpMismatch = await db.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*)::bigint AS cnt
    FROM "User" u
    JOIN "Employee" e ON e.id = u."employeeId"
    WHERE u."clientId" IN (${SOURCE_CLIENT_ID}, ${newClientId})
      AND u."clientId" <> e."clientId"
  `;
  const activeOldTokensOnNewUsers = await db.refreshToken.count({
    where: {
      revokedAt: null,
      OR: [
        { user: { clientId: newClientId, role: { not: 'CLIENT_ADMIN' } } },
        { userId: newAdmin.id, createdAt: { lt: newClient.createdAt } },
      ],
    },
  });
  const leakedAdminNotificationRecipients = await db.notificationUserRecipient.count({
    where: {
      notification: { clientId: newClientId },
      user: {
        email: SOURCE_ADMIN_EMAIL,
      },
    },
  });
  const activeMigratedUsers = await db.user.count({
    where: {
      clientId: newClientId,
      role: { not: 'CLIENT_ADMIN' },
      isActive: true,
    },
  });

  assertions.zeroCrossTenantRoutes = crossRoutes === 0;
  assertions.zeroCrossTenantAssignments = crossAssigns === 0;
  assertions.zeroCrossTenantSessions = crossSessions === 0;
  assertions.historicalThirdPartyRt10CheckpointSessionsCount = historicalThirdPartyRt10Sessions;
  assertions.zeroCrossTenantSubTaskMasterLinks = crossMasterLinks === 0;
  assertions.zeroUserEmployeeClientMismatches = Number(userEmpMismatch[0]?.cnt ?? 0) === 0;
  assertions.zeroUnrevokedPreCutoverRefreshTokens = activeOldTokensOnNewUsers === 0;
  assertions.zeroSourceAdminNotificationLeaks = leakedAdminNotificationRecipients === 0;
  assertions.migratedGuardsRemainInactive = activeMigratedUsers === 0;

  if (preRt10Digest) {
    const postRt10 = await captureRt10Snapshot(db);
    assertions.rt10SnapshotByteForByteIdentical = postRt10.digest === preRt10Digest;
  }
  if (preRt11QrDigest) {
    const postQr = await captureRt11QrSignature(db);
    assertions.rt11PhysicalQrsUnchanged = postQr.digest === preRt11QrDigest;
  }

  const newNotifSettings = await db.clientNotificationSettings.findUnique({
    where: { clientId: newClientId },
    include: { recipients: true },
  });
  assertions.newClientNotificationSettingsSafeDefault =
    Boolean(newNotifSettings) &&
    newNotifSettings!.patrolCompletedEmailEnabled === false &&
    newNotifSettings!.recipients.length === 0;

  const membershipsOnNew = await db.managerClientMembership.count({
    where: { clientId: newClientId },
  });
  assertions.managerMembershipsCount = membershipsOnNew;
  if (!opts.grantManagerMemberships) {
    assertions.noAutoGrantedManagerMemberships = membershipsOnNew === 0;
  }

  const failed = Object.entries(assertions).filter(([, val]) => val === false);
  if (failed.length > 0) {
    throw new Error(`Post-migration verification failed checks: ${failed.map(([k]) => k).join(', ')}`);
  }

  return assertions;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  assertSafeTargetDatabase(opts);

  const prisma = new PrismaClient();
  try {
    const rt10Pre = await captureRt10Snapshot(prisma);
    const rt11QrPre = await captureRt11QrSignature(prisma);
    const scope = await discoverScope(prisma);

    if (opts.mode === 'verify') {
      if (scope.migratedState !== 'ALREADY_MIGRATED' || !scope.newClientByEmail) {
        throw new Error('Cannot --verify: tenant separation has not been executed yet on this database.');
      }
      const assertions = await verifyPostMigration(
        prisma,
        scope.newClientByEmail.id,
        opts,
        undefined,
        rt11QrPre.digest,
      );
      const result = {
        mode: 'verify',
        migratedState: scope.migratedState,
        newClient: {
          id: scope.newClientByEmail.id,
          clientCode: scope.newClientByEmail.clientCode,
          companyName: scope.newClientByEmail.companyName,
          email: scope.newClientByEmail.email,
        },
        assertions,
      };
      console.log(JSON.stringify(result, null, 2));
      if (opts.jsonReportPath) fs.writeFileSync(opts.jsonReportPath, JSON.stringify(result, null, 2));
      return;
    }

    if (opts.mode === 'dry-run') {
      const plan = {
        mode: 'dry-run',
        migratedState: scope.migratedState,
        targetCompanyName: opts.companyName,
        newAdminEmail: NEW_ADMIN_EMAIL,
        grantManagerMemberships: opts.grantManagerMemberships,
        preSnapshot: {
          rt10Digest: rt10Pre.digest,
          rt10Counts: rt10Pre.counts,
          rt11QrDigest: rt11QrPre.digest,
          rt11Gates: rt11QrPre.gateCount,
          rt11GateSubTasks: rt11QrPre.gateSubTaskCount,
        },
        plannedChanges: {
          sitesToMove: 1,
          gatesKeptUnchanged: rt11QrPre.gateCount,
          gateSubTasksRemapped: scope.rt11LinkedMasterItems.length,
          patrolRoutesToMove: scope.rt11Routes.length,
          guardAssignmentsToMove: scope.rt11Assignments.length,
          sharedShiftsToClone: scope.sharedShifts.map((s) => ({
            id: s.id,
            shiftCode: s.shiftCode,
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
          subTaskMastersToClone: scope.sharedMasters.map((m) => ({
            id: m.id,
            role: m.role,
            name: m.name,
            itemsCount: m.items.length,
          })),
          employeesToMove: scope.ctEmployees.map((e) => ({
            id: e.id,
            employeeNumber: e.employeeNumber,
            email: e.email,
            status: e.status,
            userIsActive: e.user?.isActive ?? null,
          })),
          refreshTokensToRevokeAndMove: scope.ctRefreshTokens.length,
          patrolSessionsToMove: scope.rt11Sessions.length,
          incidentsToMove: scope.rt11Incidents.length,
          notificationsToMove: scope.rt11Notifications.length,
          notificationDeliveriesToMove: scope.rt11Deliveries.length,
          existingSourceManagerMemberships: scope.sourceManagerMemberships.map((m) => m.managerUser.email),
        },
      };
      console.log(JSON.stringify(plan, null, 2));
      if (opts.jsonReportPath) fs.writeFileSync(opts.jsonReportPath, JSON.stringify(plan, null, 2));
      return;
    }

    // --execute mode
    if (scope.migratedState === 'ALREADY_MIGRATED' && scope.newClientByEmail) {
      const assertions = await verifyPostMigration(
        prisma,
        scope.newClientByEmail.id,
        opts,
        rt10Pre.digest,
        rt11QrPre.digest,
      );
      const idempotentResult = {
        mode: 'execute',
        status: 'NOOP_ALREADY_MIGRATED',
        newClientId: scope.newClientByEmail.id,
        clientCode: scope.newClientByEmail.clientCode,
        companyName: scope.newClientByEmail.companyName,
        assertions,
      };
      console.log(JSON.stringify(idempotentResult, null, 2));
      if (opts.jsonReportPath) {
        fs.writeFileSync(opts.jsonReportPath, JSON.stringify(idempotentResult, null, 2));
      }
      return;
    }

    // Collision guard against existing KAIZEN - Cleopatra client
    const existingCleopatra = await prisma.client.findFirst({
      where: { companyName: { equals: opts.companyName, mode: 'insensitive' } },
      select: { id: true, clientCode: true, companyName: true },
    });
    if (existingCleopatra) {
      throw new Error(
        `A Client with companyName "${opts.companyName}" already exists (${existingCleopatra.clientCode} / ${existingCleopatra.id}). Pass an approved unique --company-name.`,
      );
    }

    const saltRounds = Number(process.env.BCRYPT_ROUNDS || 12);
    const temporaryPassword = randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(temporaryPassword, saltRounds);

    const execSummary = await prisma.$transaction(
      async (tx) => {
        // 1. Increment GLOBAL CLIENT counter safely (mirrors ClientService.create)
        const maxClientRow = await tx.client.findMany({ select: { clientCode: true } });
        const maxExistingClientSeq = maxClientRow.reduce(
          (max, c) => Math.max(max, extractCodeSequence(c.clientCode)),
          0,
        );
        const existingCounter = await tx.counter.findUnique({
          where: { entity_clientId: { entity: 'CLIENT', clientId: 'GLOBAL' } },
        });
        let seq = Math.max(existingCounter?.value ?? 0, maxExistingClientSeq) + 1;
        let clientCode = formatClientCode(seq);
        while (await tx.client.findUnique({ where: { clientCode } })) {
          seq += 1;
          clientCode = formatClientCode(seq);
        }
        await tx.counter.upsert({
          where: { entity_clientId: { entity: 'CLIENT', clientId: 'GLOBAL' } },
          update: { value: seq },
          create: { entity: 'CLIENT', clientId: 'GLOBAL', value: seq },
        });

        // 2. Create New Independent Client Tenant & CLIENT_ADMIN User
        const newClient = await tx.client.create({
          data: {
            clientCode,
            companyName: opts.companyName,
            email: NEW_ADMIN_EMAIL,
            authorizedPerson: scope.sourceClient.authorizedPerson,
            phone: scope.sourceClient.phone,
            address: scope.sourceClient.address,
            subscriptionStatus: scope.sourceClient.subscriptionStatus,
            identificationMethod: scope.sourceClient.identificationMethod,
            maxEmployees: scope.sourceClient.maxEmployees,
            maxCheckpoints: scope.sourceClient.maxCheckpoints,
            isActive: true,
          },
        });

        const newAdminUser = await tx.user.create({
          data: {
            clientId: newClient.id,
            email: NEW_ADMIN_EMAIL,
            password: hashedPassword,
            rawPassword: temporaryPassword,
            role: 'CLIENT_ADMIN',
            isActive: true,
          },
        });

        // 3. Safe Default Notification Settings (no copied recipients until confirmed)
        await tx.clientNotificationSettings.create({
          data: {
            clientId: newClient.id,
            patrolCompletedEmailEnabled: false,
          },
        });

        // 4. Optional ManagerClientMembership cloning (off unless explicitly enabled)
        const grantedManagers: string[] = [];
        if (opts.grantManagerMemberships && scope.sourceManagerMemberships.length > 0) {
          for (const membership of scope.sourceManagerMemberships) {
            await tx.managerClientMembership.create({
              data: {
                managerUserId: membership.managerUserId,
                clientId: newClient.id,
                isActive: true,
              },
            });
            grantedManagers.push(membership.managerUser.email);
          }
        }

        // 5. Clone Shared Shifts onto newClientId (keeping source Shifts intact)
        const shiftIdMap = new Map<string, string>();
        for (const shift of scope.sharedShifts) {
          const clonedShift = await tx.shift.create({
            data: {
              clientId: newClient.id,
              shiftCode: shift.shiftCode,
              name: shift.name,
              startTime: shift.startTime,
              endTime: shift.endTime,
              mandatoryPatrol1Time: shift.mandatoryPatrol1Time,
              mandatoryPatrol1WindowBefore: shift.mandatoryPatrol1WindowBefore,
              mandatoryPatrol1WindowAfter: shift.mandatoryPatrol1WindowAfter,
              mandatoryPatrol2Time: shift.mandatoryPatrol2Time,
              mandatoryPatrol2WindowBefore: shift.mandatoryPatrol2WindowBefore,
              mandatoryPatrol2WindowAfter: shift.mandatoryPatrol2WindowAfter,
              description: shift.description,
              isActive: shift.isActive,
            },
          });
          shiftIdMap.set(shift.id, clonedShift.id);
        }

        // 6. Clone Shared SubTaskMasters & Items and remap RT-11 GateSubTask.sourceMasterItemId
        const masterItemIdMap = new Map<string, string>();
        for (const master of scope.sharedMasters) {
          const clonedMaster = await tx.subTaskMaster.create({
            data: {
              clientId: newClient.id,
              role: master.role,
              name: master.name,
              description: master.description,
              isActive: master.isActive,
            },
          });
          for (const item of master.items) {
            const clonedItem = await tx.subTaskMasterItem.create({
              data: {
                masterId: clonedMaster.id,
                taskName: item.taskName,
                description: item.description,
                displayOrder: item.displayOrder,
                isRequired: item.isRequired,
                isActive: item.isActive,
              },
            });
            masterItemIdMap.set(item.id, clonedItem.id);
          }
        }
        let remappedGateSubTasks = 0;
        for (const [oldItemId, newItemId] of masterItemIdMap.entries()) {
          const res = await tx.gateSubTask.updateMany({
            where: {
              gateId: { in: scope.rt11GateIds },
              sourceMasterItemId: oldItemId,
            },
            data: { sourceMasterItemId: newItemId },
          });
          remappedGateSubTasks += res.count;
        }

        // 7. Transfer RT-11 Site (preserve isActive=false, siteCode, gates & physical QRs untouched)
        await tx.site.update({
          where: { id: RT11_SITE_ID },
          data: { clientId: newClient.id },
        });

        // 8. Transfer RT-11 PatrolRoutes (preserve isActive=false, routeCode)
        const movedRoutes = await tx.patrolRoute.updateMany({
          where: { siteId: RT11_SITE_ID },
          data: { clientId: newClient.id },
        });

        // 9. Transfer RT-11 GuardAssignments + remap shiftId to cloned tenant Shift
        let movedAssignments = 0;
        for (const [oldShiftId, newShiftId] of shiftIdMap.entries()) {
          const res = await tx.guardAssignment.updateMany({
            where: { siteId: RT11_SITE_ID, shiftId: oldShiftId },
            data: { clientId: newClient.id, shiftId: newShiftId },
          });
          movedAssignments += res.count;
        }

        // 10. Transfer exclusive @ct.com Employees, Users, and revoke/re-scope RefreshTokens
        const movedEmployees = await tx.employee.updateMany({
          where: { id: { in: scope.ctEmployeeIds } },
          data: { clientId: newClient.id },
        });
        const movedUsers = await tx.user.updateMany({
          where: { id: { in: scope.ctUserIds } },
          data: { clientId: newClient.id },
        });
        const now = new Date();
        const revokedTokens = await tx.refreshToken.updateMany({
          where: { userId: { in: scope.ctUserIds } },
          data: { clientId: newClient.id, revokedAt: now },
        });

        // Move any FaceEnrollments, Attendances, MandatoryPatrolInstances for RT-11 employees/site
        const movedFaceEnrollments = await tx.faceEnrollment.updateMany({
          where: { employeeId: { in: scope.ctEmployeeIds } },
          data: { clientId: newClient.id },
        });
        const movedAttendances = await tx.attendance.updateMany({
          where: { OR: [{ siteId: RT11_SITE_ID }, { employeeId: { in: scope.ctEmployeeIds } }] },
          data: { clientId: newClient.id },
        });
        let movedMandatoryInstances = 0;
        for (const [oldShiftId, newShiftId] of shiftIdMap.entries()) {
          const res = await tx.mandatoryPatrolInstance.updateMany({
            where: {
              OR: [
                { assignment: { siteId: RT11_SITE_ID } },
                { employeeId: { in: scope.ctEmployeeIds } },
              ],
              shiftId: oldShiftId,
            },
            data: { clientId: newClient.id, shiftId: newShiftId },
          });
          movedMandatoryInstances += res.count;
        }

        // 11. Transfer RT-11 PatrolSessions (preserve verifiedById historical audit trail)
        const movedSessions = await tx.patrolSession.updateMany({
          where: { id: { in: scope.rt11SessionIds } },
          data: { clientId: newClient.id },
        });

        // 12. Transfer RT-11 Incidents
        const movedIncidents = await tx.incident.updateMany({
          where: { id: { in: scope.rt11Incidents.map((i) => i.id) } },
          data: { clientId: newClient.id },
        });

        // 13. Transfer RT-11 Notifications & prune non-authorized user recipients
        let movedNotificationsCount = 0;
        let deletedNotificationRecipientsCount = 0;
        if (scope.rt11NotificationIds.length > 0) {
          const movedNotifs = await tx.notification.updateMany({
            where: { id: { in: scope.rt11NotificationIds } },
            data: { clientId: newClient.id },
          });
          movedNotificationsCount = movedNotifs.count;

          if (opts.pruneNonMemberNotificationRecipients) {
            const allowedUserIds = [newAdminUser.id, ...scope.ctUserIds];
            if (opts.grantManagerMemberships) {
              for (const m of scope.sourceManagerMemberships) {
                allowedUserIds.push(m.managerUserId);
              }
            }
            const pruned = await tx.notificationUserRecipient.deleteMany({
              where: {
                notificationId: { in: scope.rt11NotificationIds },
                userId: { notIn: allowedUserIds },
              },
            });
            deletedNotificationRecipientsCount = pruned.count;
          }
        }

        // 14. Transfer RT-11 NotificationDeliveries
        let movedDeliveriesCount = 0;
        if (scope.rt11Deliveries.length > 0) {
          const res = await tx.notificationDelivery.updateMany({
            where: { id: { in: scope.rt11Deliveries.map((d) => d.id) } },
            data: { clientId: newClient.id },
          });
          movedDeliveriesCount = res.count;
        }

        // 15. Seed Client-Scoped Counters on newClientId
        const maxSiteSeq = Math.max(2, extractCodeSequence(scope.rt11Site.siteCode));
        const maxShiftSeq = Math.max(
          0,
          ...scope.sharedShifts.map((s) => extractCodeSequence(s.shiftCode)),
        );
        const maxRouteSeq = Math.max(
          0,
          ...scope.rt11Routes.map((r) => extractCodeSequence(r.routeCode)),
        );
        const maxSessionSeq = Math.max(
          0,
          ...scope.rt11Sessions.map((s) => extractCodeSequence(s.patrolCode)),
        );
        const maxEmployeeSeq = Math.max(
          0,
          ...scope.ctEmployees.map((e) => extractCodeSequence(e.employeeNumber)),
        );

        const countersToSeed = [
          { entity: 'SITE', value: maxSiteSeq },
          { entity: 'SHIFT', value: maxShiftSeq },
          { entity: 'PATROL', value: maxRouteSeq },
          { entity: 'PATROL_SESSION', value: maxSessionSeq },
          { entity: 'EMPLOYEE', value: maxEmployeeSeq },
        ];
        for (const c of countersToSeed) {
          await tx.counter.upsert({
            where: { entity_clientId: { entity: c.entity, clientId: newClient.id } },
            update: { value: c.value },
            create: { entity: c.entity, clientId: newClient.id, value: c.value },
          });
        }

        // 16. Verify ALL invariants INSIDE transaction before commit!
        const assertions = await verifyPostMigration(
          tx,
          newClient.id,
          opts,
          rt10Pre.digest,
          rt11QrPre.digest,
        );

        return {
          newClient: {
            id: newClient.id,
            clientCode: newClient.clientCode,
            companyName: newClient.companyName,
            email: newClient.email,
          },
          newAdminUser: {
            id: newAdminUser.id,
            email: newAdminUser.email,
            role: newAdminUser.role,
            isActive: newAdminUser.isActive,
          },
          counts: {
            clonedShifts: shiftIdMap.size,
            clonedSubTaskMasters: scope.sharedMasters.length,
            clonedSubTaskMasterItems: masterItemIdMap.size,
            remappedGateSubTasks,
            movedSites: 1,
            movedRoutes: movedRoutes.count,
            movedAssignments,
            movedEmployees: movedEmployees.count,
            movedUsers: movedUsers.count,
            revokedRefreshTokens: revokedTokens.count,
            movedFaceEnrollments: movedFaceEnrollments.count,
            movedAttendances: movedAttendances.count,
            movedMandatoryInstances,
            movedPatrolSessions: movedSessions.count,
            movedIncidents: movedIncidents.count,
            movedNotifications: movedNotificationsCount,
            deletedNotificationRecipients: deletedNotificationRecipientsCount,
            movedNotificationDeliveries: movedDeliveriesCount,
            grantedManagerMemberships: grantedManagers.length,
          },
          seededCounters: countersToSeed,
          assertions,
        };
      },
      { maxWait: 15000, timeout: 60000 },
    );

    if (opts.credentialsOutPath) {
      fs.writeFileSync(
        opts.credentialsOutPath,
        JSON.stringify(
          {
            clientId: execSummary.newClient.id,
            clientCode: execSummary.newClient.clientCode,
            companyName: execSummary.newClient.companyName,
            email: NEW_ADMIN_EMAIL,
            temporaryPassword,
            generatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
    }

    const output = {
      mode: 'execute',
      status: 'MIGRATED_AND_VERIFIED',
      ...execSummary,
    };
    console.log(JSON.stringify(output, null, 2));
    if (opts.jsonReportPath) fs.writeFileSync(opts.jsonReportPath, JSON.stringify(output, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration aborted cleanly:', err);
  process.exit(1);
});
