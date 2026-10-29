import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { assertCentralManagerClientAccess } from '../../common/auth/central-manager-auth';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { formatPatrolDateTime, formatPatrolDate, formatPatrolTime, calculatePatrolDurationSeconds, resolveCheckpointTiming, calculateOverlapDurationSeconds, formatDurationHuman, getDateStringInTimezone, getReportingPeriodBoundaries, ReportingPeriodResult } from '../../common/utils/date-formatter.util';
import { isCheckpointEligibleForSession } from '../../common/utils/checkpoint-eligibility.util';
import { maskEmiratesId } from '../../common/utils/emirates-id.util';

export type ReportPeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export interface SummaryReportParams {
  periodType: ReportPeriodType;
  date?: string; // YYYY-MM-DD
  week?: string; // YYYY-MM-DD or YYYY-Wxx
  month?: string; // YYYY-MM
  startDate?: string;
  endDate?: string;
  fromDate?: string;
  toDate?: string;
  clientId?: string;
  siteId?: string;
  employeeId?: string;
  role?: string;
  roleId?: string;
  shiftId?: string;
  user: {
    id: string;
    role: string;
    clientId?: string | null;
    tenantId?: string | null;
  };
}

export function formatRoleLabel(role?: string | null, designation?: string | null): string {
  if (designation && designation.trim()) {
    const dLower = designation.trim().toLowerCase();
    if (dLower === 'security' || dLower === 'security guard' || dLower === 'guard') {
      return 'Security Guard';
    }
    return designation.trim();
  }
  if (!role) return 'Security Guard';
  const ROLE_MAP: Record<string, string> = {
    SECURITY: 'Security Guard',
    SECURITY_GUARD: 'Security Guard',
    GUARD: 'Security Guard',
    CLEANER: 'House Keeping',
    HOUSE_KEEPING: 'House Keeping',
    TECHNICIAN: 'Technician',
    SUPERVISOR: 'Supervisor',
    MANAGER: 'Community Manager',
    COMMUNITY_MANAGER: 'Community Manager',
    CENTRAL_MANAGER: 'Community Manager',
    SERVICE_ENGINEER: 'Service Engineer',
    PLUMBER: 'Plumber',
    LIFE_GUARD: 'Lifeguard',
  };
  return ROLE_MAP[role.toUpperCase()] || role;
}

export interface ReportDataset {
  metadata: {
    title: string;
    periodType: ReportPeriodType;
    periodLabel: string;
    startDate: string;
    endDate: string;
    clientName: string;
    clientLogoUrl?: string | null;
    siteName?: string;
    shiftName?: string;
    roleLabel?: string;
    employeeId?: string;
    employeeName?: string;
    employeeRole?: string;
    employeeNumber?: string;
    emiratesId?: string | null;
    generatedAt: string;
    timezone: string;
    includeIncidents?: boolean;
    isKaizen?: boolean;
  };
  summary: {
    totalEmployees: number;
    activeEmployees: number;
    totalShifts: number;
    assignedPatrols: number;
    completedPatrols: number;
    incompletePatrols: number;
    additionalPatrols: number;
    mandatoryScheduled: number;
    mandatoryCompleted: number;
    mandatoryMissed: number;
    mandatoryCompliancePct: number;
    totalCheckpoints: number;
    checkpointsScanned: number;
    checkpointsMissed: number;
    requiredCheckpoints: number;
    completedCheckpoints: number;
    missedCheckpoints: number;
    checkpointCompletionPct: number;
    incidentsCount: number;
    // Duration Analytics
    totalPatrolDurationSeconds: number;
    totalPatrolDurationFormatted: string;
    totalCheckpointDurationSeconds: number;
    totalCheckpointDurationFormatted: string;
    completedPatrolsCount: number;
    completedCheckpointsCount: number;
    avgPatrolDurationSeconds: number;
    avgPatrolDurationFormatted: string;
    avgCheckpointDurationSeconds: number;
    avgCheckpointDurationFormatted: string;
    unavailableDurationsCount: number;
    unavailablePatrolDurationsCount: number;
    unavailableCheckpointDurationsCount: number;
    untrackedDurationPatrolsCount?: number;
    untrackedDurationCheckpointsCount?: number;
  };
  dailyBreakdown: Array<{
    date: string;
    dateFormatted: string;
    shiftName: string;
    siteName: string;
    patrolSessionsCount: number;
    patrolDurationSeconds: number;
    patrolDurationFormatted: string;
    checkpointsCount: number;
    checkpointDurationSeconds: number;
    checkpointDurationFormatted: string;
  }>;
  attendance: Array<{
    id: string;
    shiftDate: string;
    employeeName: string;
    employeeRole: string;
    employeeNumber: string;
    siteName: string;
    shiftName: string;
    checkInTime: string;
    checkOutTime: string | null;
    status: string;
    isLate: boolean;
  }>;
  patrols: Array<{
    id: string;
    patrolCode: string;
    employeeName: string;
    guardName: string;
    employeeRole: string;
    employeeCode: string;
    siteName: string;
    routeName: string;
    shiftName: string;
    startedAt: string;
    startedAtRaw: string;
    completedAt: string | null;
    completedAtRaw: string | null;
    endedAt: string | null;
    durationMins: number;
    durationSeconds: number;
    durationFormatted: string;
    fullDurationSeconds: number;
    fullDurationFormatted: string;
    checkpointDurationSeconds: number;
    checkpointDurationFormatted: string;
    status: string;
    checkpointsCompleted: number;
    checkpointsRequired: number;
    checkpointCount: number;
    checkpointsDisplay: string;
  }>;
  mandatoryPatrols: Array<{
    id: string;
    sequence: number;
    guardName: string;
    employeeRole: string;
    siteName: string;
    shiftName: string;
    scheduledAt: string;
    windowStart: string;
    windowEnd: string;
    status: string;
    completedAt: string | null;
  }>;
  checkpoints: Array<{
    id: string;
    gateName: string;
    siteName: string;
    guardName: string;
    patrolCode: string;
    scannedAt: string;
    status: string;
    remarks: string | null;
  }>;
  incidents: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    siteName: string;
    guardName: string;
    reportedAt: string;
    description: string;
  }>;
  siteSummary: Array<{
    siteId: string;
    siteName: string;
    employeesCount: number;
    completedPatrols: number;
    mandatoryScheduled: number;
    mandatoryCompleted: number;
    mandatoryCompliancePct: number;
    completedCheckpoints: number;
    requiredCheckpoints: number;
    incidentsCount: number;
  }>;
  employeeSummary: Array<{
    employeeId: string;
    employeeName: string;
    employeeRole: string;
    siteName: string;
    completedPatrols: number;
    patrolDurationSeconds: number;
    patrolDurationFormatted: string;
    mandatoryScheduled: number;
    mandatoryCompleted: number;
    mandatoryCompliancePct: number;
    checkpointsScanned: number;
    completedCheckpoints: number;
    checkpointDurationSeconds: number;
    checkpointDurationFormatted: string;
    incidentsCount: number;
  }>;
}

export interface EmployeePatrolsQueryParams extends SummaryReportParams {
  employeeId: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EmployeeCompletedPatrolsResult {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string | null;
    fullName: string;
    role: string;
    roleLabel: string;
    designation: string | null;
    emiratesId?: string | null;
  };
  project: {
    id: string;
    companyName: string;
    clientCode: string;
    clientLogoUrl?: string | null;
  };
  period: {
    periodType: ReportPeriodType;
    periodLabel: string;
    startDate: string;
    endDate: string;
    timezone: string;
  };
  filters: {
    shiftId: string | null;
    siteId: string | null;
    role: string | null;
  };
  summary: {
    totalCompletedPatrols: number;
    totalPatrolDurationSeconds: number;
    totalPatrolDurationFormatted: string;
    totalCheckpointsScanned: number;
    totalCheckpointsRequired: number;
    averageCompliancePct: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
  };
  patrols: Array<{
    id: string;
    patrolCode: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    dateFormatted: string;
    startTimeFormatted: string;
    endTimeFormatted: string;
    siteName: string;
    routeName: string;
    shiftName: string;
    durationSeconds: number;
    durationFormatted: string;
    scannedCheckpoints: number;
    totalCheckpoints: number;
    compliancePct: number;
    remarks: string | null;
  }>;
}

export class SummaryReportService {
  /**
   * Computes authoritative date range for DAILY, WEEKLY, MONTHLY, or CUSTOM period types
   * using the centralized, timezone-aware reporting period resolver.
   */
  private computeDateRange(params: SummaryReportParams): ReportingPeriodResult {
    const timezone = 'Asia/Dubai';
    try {
      return getReportingPeriodBoundaries(params.periodType, params, timezone);
    } catch (err: any) {
      throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, err.message);
    }
  }

  /**
   * Resolves authorized Client IDs for request.
   */
  private async resolveAuthorizedClientIds(params: SummaryReportParams): Promise<string[]> {
    const { user, clientId } = params;

    if (user.role === 'CLIENT_ADMIN') {
      const authClientId = user.clientId || user.tenantId;
      if (!authClientId) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'User has no assigned Client ID.');
      }
      if (clientId && clientId !== authClientId) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized client access requested.');
      }
      return [authClientId];
    } else {
      // Centralized Manager / Admin
      return assertCentralManagerClientAccess(user, clientId);
    }
  }

  /**
   * Main Report Generator: Generates normalized ReportDataset
   */
  async generateReportDataset(params: SummaryReportParams): Promise<ReportDataset> {
    const clientIds = await this.resolveAuthorizedClientIds(params);
    const { from, to, periodLabel, startDateStr, endDateStr } = this.computeDateRange(params);
    const { siteId, periodType } = params;

    const rawEmployeeId = params.employeeId;
    const employeeId =
      rawEmployeeId &&
      typeof rawEmployeeId === 'string' &&
      rawEmployeeId.trim() !== '' &&
      rawEmployeeId.toLowerCase() !== 'all' &&
      rawEmployeeId.toLowerCase() !== 'null' &&
      rawEmployeeId.toLowerCase() !== 'undefined'
        ? rawEmployeeId.trim()
        : undefined;

    const rawRole = params.role || params.roleId;
    const cleanRoleStr =
      rawRole &&
      typeof rawRole === 'string' &&
      rawRole.trim() !== '' &&
      rawRole.toUpperCase() !== 'ALL' &&
      rawRole.toLowerCase() !== 'all' &&
      rawRole.toLowerCase() !== 'null' &&
      rawRole.toLowerCase() !== 'undefined'
        ? rawRole.trim().toUpperCase()
        : undefined;

    let targetRoleEnum: UserRole | undefined = undefined;
    if (cleanRoleStr) {
      if (cleanRoleStr === 'SECURITY_GUARD' || cleanRoleStr === 'GUARD' || cleanRoleStr === 'SECURITY') {
        targetRoleEnum = UserRole.SECURITY;
      } else if (Object.values(UserRole).includes(cleanRoleStr as any)) {
        targetRoleEnum = cleanRoleStr as UserRole;
      }
    }
    const roleLabel = targetRoleEnum ? formatRoleLabel(targetRoleEnum) : cleanRoleStr || 'All Roles';

    const rawShiftId = params.shiftId;
    const shiftId =
      rawShiftId &&
      typeof rawShiftId === 'string' &&
      rawShiftId.trim() !== '' &&
      rawShiftId.toUpperCase() !== 'ALL' &&
      rawShiftId.toLowerCase() !== 'all' &&
      rawShiftId.toLowerCase() !== 'null' &&
      rawShiftId.toLowerCase() !== 'undefined'
        ? rawShiftId.trim()
        : undefined;

    const timezone = 'Asia/Dubai';

    // Verify Shift authorization if provided
    let shiftName: string | undefined;
    if (shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        select: { id: true, name: true, clientId: true },
      });
      if (!shift || !clientIds.includes(shift.clientId)) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized shift filter requested.');
      }
      shiftName = shift.name;
    }

    // Verify Site authorization if provided
    let siteName: string | undefined;
    let siteClient: any = null;
    if (siteId) {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: {
          id: true,
          clientId: true,
          name: true,
          client: { select: { companyName: true, clientCode: true, clientLogoUrl: true } },
        },
      });
      if (!site || !clientIds.includes(site.clientId)) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized site filter requested.');
      }
      siteName = site?.name;
      siteClient = site?.client;
    }

    const client =
      siteClient ||
      (await prisma.client.findFirst({
        where: { id: { in: clientIds } },
        select: { companyName: true, clientCode: true, clientLogoUrl: true },
      }));
    const clientName = client?.companyName || 'Security Services Client';
    const clientLogoUrl = client?.clientLogoUrl || null;
    const isKaizen = clientName.toLowerCase().includes('kaizen');
    const includeIncidents = !isKaizen;

    let scopedEmployee: any = null;
    let employeeName: string | undefined;
    let employeeRole: string | undefined;
    let employeeNumber: string | undefined;

    if (employeeId) {
      scopedEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { user: true },
      });
      if (!scopedEmployee || !clientIds.includes(scopedEmployee.clientId)) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized employee report access requested.');
      }
      if (targetRoleEnum && scopedEmployee.role !== targetRoleEnum) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          `Selected employee does not belong to role ${formatRoleLabel(targetRoleEnum)}.`,
        );
      }
      employeeName = `${scopedEmployee.firstName} ${scopedEmployee.lastName || ''}`.trim();
      employeeRole = formatRoleLabel(scopedEmployee.role, scopedEmployee.designation);
      employeeNumber = scopedEmployee.employeeNumber || '—';
    }

    // Build base query filters
    const baseWhereClient = { clientId: { in: clientIds } };
    const siteFilter = siteId ? { siteId } : {};
    const shiftFilter = shiftId ? { shiftId } : {};
    const employeeFilter = employeeId ? { employeeId } : {};
    const employeeModelFilter = employeeId ? { id: employeeId } : {};
    const roleEmployeeFilter = targetRoleEnum ? { role: targetRoleEnum } : {};

    // 1. Employees query
    const [totalEmployees, activeEmployees] = employeeId
      ? [1, scopedEmployee.status === 'ACTIVE' ? 1 : 0]
      : await Promise.all([
          prisma.employee.count({
            where: {
              ...baseWhereClient,
              ...roleEmployeeFilter,
              ...(siteId ? { assignments: { some: { siteId, isActive: true } } } : {}),
              ...(shiftId ? { assignments: { some: { shiftId, isActive: true } } } : {}),
            },
          }),
          prisma.employee.count({
            where: {
              ...baseWhereClient,
              ...roleEmployeeFilter,
              status: 'ACTIVE',
              ...(siteId ? { assignments: { some: { siteId, isActive: true } } } : {}),
              ...(shiftId ? { assignments: { some: { shiftId, isActive: true } } } : {}),
            },
          }),
        ]);

    // 2. Shifts & Assignments count
    const totalShifts = shiftId
      ? 1
      : await prisma.shift.count({
          where: {
            ...baseWhereClient,
            isActive: true,
            ...(siteId ? { assignments: { some: { siteId, isActive: true } } } : {}),
          },
        });

    // 3. Patrol Sessions query with full relations and boundary overlap support
    const dateWindowFilter = {
      OR: [
        { startedAt: { gte: from, lt: to } },
        { endedAt: { gt: from, lte: to } },
        {
          AND: [
            { startedAt: { lte: from } },
            { endedAt: { gte: to } },
          ],
        },
        {
          AND: [
            { startedAt: { lt: to, gte: new Date(from.getTime() - 24 * 60 * 60 * 1000) } },
            { endedAt: null },
          ],
        },
      ],
    };

    const andFilters: any[] = [dateWindowFilter];
    let topLevelOr: any = undefined;

    if (employeeId && targetRoleEnum) {
      topLevelOr = [
        { assignment: { employeeId } },
        { managerUser: { employee: { id: employeeId } } },
      ];
      andFilters.push({
        OR: [
          { assignment: { employee: { role: targetRoleEnum } } },
          { managerUser: { employee: { role: targetRoleEnum } } },
        ],
      });
    } else if (employeeId) {
      topLevelOr = [
        { assignment: { employeeId } },
        { managerUser: { employee: { id: employeeId } } },
      ];
    } else if (targetRoleEnum) {
      topLevelOr = [
        { assignment: { employee: { role: targetRoleEnum } } },
        { managerUser: { employee: { role: targetRoleEnum } } },
      ];
    }

    const patrolWhere: any = {
      ...baseWhereClient,
      ...(siteId || shiftId
        ? {
            assignment: {
              ...(siteId ? { siteId } : {}),
              ...(shiftId ? { shiftId } : {}),
            },
          }
        : {}),
      AND: andFilters,
      ...(topLevelOr ? { OR: topLevelOr } : {}),
    };

    const patrolSessions = await prisma.patrolSession.findMany({
      where: patrolWhere,
      include: {
        assignment: {
          include: {
            employee: true,
            site: true,
            shift: true,
            patrolRoute: {
              include: {
                routeGates: {
                  include: {
                    gate: true,
                  },
                },
              },
            },
            assignmentGates: {
              include: {
                gate: true,
              },
            },
          },
        },
        managerUser: {
          include: { employee: true },
        },
        checkpoints: {
          include: {
            gate: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    const completedPatrolsCount = patrolSessions.filter((p) => {
      if (p.status !== 'COMPLETED') return false;
      if (p.endedAt) {
        return p.endedAt > from && p.startedAt < to;
      }
      return p.startedAt >= from && p.startedAt < to;
    }).length;
    const incompletePatrolsCount = patrolSessions.filter((p) => {
      if (p.status === 'COMPLETED') return false;
      return p.startedAt >= from && p.startedAt < to;
    }).length;

    // 4. Mandatory Patrol Instances query
    const dateOnlyFrom = new Date(`${startDateStr}T00:00:00.000Z`);
    const dateOnlyTo = new Date(`${endDateStr}T23:59:59.999Z`);

    const mandatoryInstances = await prisma.mandatoryPatrolInstance.findMany({
      where: {
        ...baseWhereClient,
        shiftDate: { gte: dateOnlyFrom, lte: dateOnlyTo },
        ...(siteId ? { assignment: { siteId } } : {}),
        ...(shiftId ? { shiftId } : {}),
        ...(targetRoleEnum ? { employee: { role: targetRoleEnum } } : {}),
        ...employeeFilter,
      },
      include: {
        employee: true,
        shift: true,
        assignment: {
          include: {
            site: true,
            shift: true,
          },
        },
      },
      orderBy: [{ shiftDate: 'desc' }, { sequence: 'asc' }],
    });

    const mandatoryScheduled = mandatoryInstances.length;
    const mandatoryCompleted = mandatoryInstances.filter((m) => m.status === 'COMPLETED').length;
    const mandatoryMissed = mandatoryInstances.filter((m) => m.status === 'MISSED').length;
    const mandatoryCompliancePct =
      mandatoryScheduled > 0 ? Math.round((mandatoryCompleted / mandatoryScheduled) * 100) : 0;

    // 5. Checkpoints & Incidents
    const getSessionRequiredCheckpointsCount = (p: any): number => {
      if (p.managerUserId) {
        return p.checkpoints?.length || 0;
      }
      const isDirect =
        (p.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
        (!p.assignment?.patrolRoute && (p.assignment?.assignmentGates?.length || 0) > 0);

      const assignedItems: any[] = isDirect
        ? (p.assignment?.assignmentGates || [])
        : (p.assignment?.patrolRoute?.routeGates || []);

      if (assignedItems.length === 0) {
        return p.checkpoints.length;
      }

      const scannedGateIds = new Set(
        (p.checkpoints || []).map((cp: any) => cp.gateId || cp.gate?.id).filter(Boolean),
      );

      const eligibleItems = assignedItems.filter((item: any) => {
        const gate = item.gate || { id: item.gateId, isActive: true };
        const gateId = gate.id || item.gateId;
        const wasScanned = scannedGateIds.has(gateId);
        return isCheckpointEligibleForSession({
          gate,
          session: {
            status: p.status,
            startedAt: p.startedAt,
            endedAt: p.endedAt,
            createdAt: p.createdAt,
          },
          isScanned: wasScanned,
          wasScanned,
        });
      });

      return eligibleItems.length > 0 ? eligibleItems.length : p.checkpoints.length;
    };

    let totalRequiredCheckpoints = 0;
    patrolSessions.forEach((p) => {
      const reqGates = getSessionRequiredCheckpointsCount(p);
      totalRequiredCheckpoints += reqGates;
    });

    const incidentSiteFilter = siteId
      ? { OR: [{ patrolSession: { assignment: { siteId } } }, { gate: { siteId } }] }
      : {};

    const rawIncidents = includeIncidents
      ? await prisma.incident.findMany({
          where: {
            ...baseWhereClient,
            createdAt: { gte: from, lt: to },
            ...incidentSiteFilter,
            ...(shiftId ? { patrolSession: { assignment: { shiftId } } } : {}),
            ...(targetRoleEnum ? { employee: { role: targetRoleEnum } } : {}),
            ...employeeFilter,
          },
          include: {
            employee: true,
            patrolSession: {
              include: {
                assignment: {
                  include: {
                    site: true,
                    shift: true,
                  },
                },
              },
            },
            gate: {
              include: {
                site: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // 6. Map Patrol Rows & Compute Exact Overlap Durations
    let totalPatrolDurationSeconds = 0;
    let totalCheckpointDurationSeconds = 0;
    let unavailablePatrolDurationsCount = 0;
    let unavailableCheckpointDurationsCount = 0;
    let completedCheckpointsCount = 0;

    const dailyMap = new Map<string, {
      date: string;
      dateFormatted: string;
      shiftName: string;
      siteName: string;
      patrolSessionsCount: number;
      patrolDurationSeconds: number;
      checkpointsCount: number;
      checkpointDurationSeconds: number;
    }>();

    const patrolRows = patrolSessions.map((p) => {
      const emp = p.assignment?.employee || p.managerUser?.employee;
      const guardName = emp
        ? `${emp.firstName} ${emp.lastName || ''}`.trim()
        : p.managerUser?.email || 'Officer';
      const employeeRole = formatRoleLabel(emp?.role, emp?.designation);
      const employeeCode = emp?.employeeNumber || '—';

      const checkpointsRequired = getSessionRequiredCheckpointsCount(p);
      const checkpointsCompleted = (p.checkpoints || []).length;

      const startedAtFormatted = formatPatrolDateTime(p.startedAt, timezone, false);
      const completedAtFormatted = p.endedAt ? formatPatrolDateTime(p.endedAt, timezone, false) : null;

      // Session Duration clipped to reporting window [from, to]
      const clippedSec = calculateOverlapDurationSeconds(p.startedAt, p.endedAt, from, to);
      const fullSec = calculatePatrolDurationSeconds(p.startedAt, p.endedAt, p.totalDuration) || 0;

      // Checkpoint Durations for this session clipped to [from, to]
      let sessionCpDurationSec = 0;
      (p.checkpoints || []).forEach((cp: any) => {
        const timing = resolveCheckpointTiming(cp, timezone);
        if (timing.isCompleted && timing.rawDurationSeconds !== null && cp.scannedAt) {
          const cpStart = new Date(cp.scannedAt);
          const cpEnd = cp.completedAt ? new Date(cp.completedAt) : cpStart;
          const cpOverlap = calculateOverlapDurationSeconds(cpStart, cpEnd, from, to);
          if (cpOverlap !== null) {
            sessionCpDurationSec += cpOverlap;
          }
        }
      });

      return {
        id: p.id,
        patrolCode: p.patrolCode,
        employeeName: guardName,
        guardName,
        employeeRole,
        employeeCode,
        siteName: p.assignment?.site?.name || 'Monitored Site',
        routeName: p.assignment?.patrolRoute?.name || 'Patrol Route',
        shiftName: p.assignment?.shift?.name || 'Shift',
        startedAt: startedAtFormatted,
        startedAtRaw: p.startedAt.toISOString(),
        completedAt: completedAtFormatted,
        completedAtRaw: p.endedAt ? p.endedAt.toISOString() : null,
        endedAt: completedAtFormatted,
        durationMins: clippedSec !== null ? Math.round(clippedSec / 60) : (p.totalDuration ? Math.round(p.totalDuration / 60) : 0),
        durationSeconds: clippedSec ?? 0,
        durationFormatted: formatDurationHuman(clippedSec ?? 0),
        fullDurationSeconds: fullSec,
        fullDurationFormatted: formatDurationHuman(fullSec),
        checkpointDurationSeconds: sessionCpDurationSec,
        checkpointDurationFormatted: formatDurationHuman(sessionCpDurationSec),
        status: p.status,
        checkpointsCompleted,
        checkpointsRequired,
        checkpointCount: checkpointsCompleted,
        checkpointsDisplay: `${checkpointsCompleted} / ${checkpointsRequired}`,
      };
    });

    // Compute cumulative aggregates across eligible completed patrols
    patrolSessions.forEach((p) => {
      // Patrol session duration
      let patrolOverlap: number | null = null;
      if (p.status === 'COMPLETED' && p.startedAt && p.endedAt) {
        patrolOverlap = calculateOverlapDurationSeconds(p.startedAt, p.endedAt, from, to);
        if (patrolOverlap !== null && patrolOverlap > 0) {
          totalPatrolDurationSeconds += patrolOverlap;
        } else if (patrolOverlap === 0) {
          // Zero overlap with reporting window
        } else {
          unavailablePatrolDurationsCount += 1;
        }
      } else if (p.status === 'COMPLETED' || !p.endedAt) {
        unavailablePatrolDurationsCount += 1;
      }

      // Checkpoint durations within session
      let sessionCpDuration = 0;
      let sessionCompletedCps = 0;
      (p.checkpoints || []).forEach((cp: any) => {
        const timing = resolveCheckpointTiming(cp, timezone);
        if (timing.isCompleted && timing.rawDurationSeconds !== null && cp.scannedAt) {
          const cpStart = new Date(cp.scannedAt);
          const cpEnd = cp.completedAt ? new Date(cp.completedAt) : cpStart;
          const cpOverlap = calculateOverlapDurationSeconds(cpStart, cpEnd, from, to);
          if (cpOverlap !== null && cpOverlap > 0) {
            totalCheckpointDurationSeconds += cpOverlap;
            sessionCpDuration += cpOverlap;
            completedCheckpointsCount += 1;
            sessionCompletedCps += 1;
          } else if (cpOverlap === 0 && cpStart >= from && cpStart < to) {
            sessionCpDuration += 0;
            completedCheckpointsCount += 1;
            sessionCompletedCps += 1;
          } else if (cpStart >= from && cpStart < to) {
            unavailableCheckpointDurationsCount += 1;
          }
        } else if (timing.isCompleted && cp.scannedAt && new Date(cp.scannedAt) >= from && new Date(cp.scannedAt) < to) {
          completedCheckpointsCount += 1;
          sessionCompletedCps += 1;
          unavailableCheckpointDurationsCount += 1;
        } else if (cp.scannedAt && new Date(cp.scannedAt) >= from && new Date(cp.scannedAt) < to) {
          unavailableCheckpointDurationsCount += 1;
        }
      });

      // Daily breakdown tracking
      const effectiveDate = p.startedAt < from ? from : p.startedAt;
      const dateKey = getDateStringInTimezone(effectiveDate, timezone) || effectiveDate.toISOString().split('T')[0];

      if (dateKey >= startDateStr && dateKey <= endDateStr) {
        const shiftNameStr = p.assignment?.shift?.name || 'Shift';
        const siteNameStr = p.assignment?.site?.name || 'Site';
        const dailyKey = `${dateKey}_${shiftNameStr}_${siteNameStr}`;

        if (!dailyMap.has(dailyKey)) {
          dailyMap.set(dailyKey, {
            date: dateKey,
            dateFormatted: formatPatrolDate(effectiveDate, timezone),
            shiftName: shiftNameStr,
            siteName: siteNameStr,
            patrolSessionsCount: 0,
            patrolDurationSeconds: 0,
            checkpointsCount: 0,
            checkpointDurationSeconds: 0,
          });
        }
        const dayItem = dailyMap.get(dailyKey)!;
        dayItem.patrolSessionsCount += 1;
        if (patrolOverlap !== null) {
          dayItem.patrolDurationSeconds += patrolOverlap;
        }
        dayItem.checkpointsCount += sessionCompletedCps;
        dayItem.checkpointDurationSeconds += sessionCpDuration;
      }
    });

    const dailyBreakdown = Array.from(dailyMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => ({
        ...d,
        patrolDurationFormatted: formatDurationHuman(d.patrolDurationSeconds),
        checkpointDurationFormatted: formatDurationHuman(d.checkpointDurationSeconds),
      }));

    // 7. Map Mandatory Patrol Rows
    const mandatoryRows = mandatoryInstances.map((m) => {
      const guardName = `${m.employee.firstName} ${m.employee.lastName || ''}`.trim();
      const employeeRole = formatRoleLabel(m.employee.role, m.employee.designation);
      return {
        id: m.id,
        sequence: m.sequence,
        guardName,
        employeeRole,
        siteName: m.assignment?.site?.name || 'Assigned Site',
        shiftName: m.assignment?.shift?.name || m.shift?.name || 'Shift',
        scheduledAt: formatPatrolDateTime(m.scheduledAt, timezone, false),
        windowStart: formatPatrolDateTime(m.windowStart, timezone, false),
        windowEnd: formatPatrolDateTime(m.windowEnd, timezone, false),
        status: m.status,
        completedAt: m.completedAt ? formatPatrolDateTime(m.completedAt, timezone, false) : null,
      };
    });

    // 8. Map Checkpoints Rows
    const checkpointRows: Array<any> = [];
    patrolSessions.forEach((p) => {
      const emp = p.assignment?.employee || p.managerUser?.employee;
      const guardName = emp
        ? `${emp.firstName} ${emp.lastName || ''}`.trim()
        : p.managerUser?.email || 'Officer';

      p.checkpoints.forEach((cp) => {
        checkpointRows.push({
          id: cp.id,
          gateName: cp.gate?.name || 'Checkpoint Gate',
          siteName: p.assignment?.site?.name || 'Monitored Site',
          guardName,
          patrolCode: p.patrolCode,
          scannedAt: formatPatrolDateTime(cp.scannedAt, timezone, false),
          status: cp.status || 'VERIFIED',
          remarks: cp.remarks,
        });
      });
    });

    // 9. Map Incidents Rows
    const incidentRows = rawIncidents.map((inc) => ({
      id: inc.id,
      type: inc.type,
      severity: inc.severity,
      status: inc.status,
      siteName: inc.patrolSession?.assignment?.site?.name || inc.gate?.site?.name || 'Site',
      guardName: inc.employee ? `${inc.employee.firstName} ${inc.employee.lastName || ''}`.trim() : 'Guard',
      reportedAt: formatPatrolDateTime(inc.createdAt, timezone, false),
      description: inc.description,
    }));

    // 10. Site Summary Aggregation
    const siteMap = new Map<string, any>();
    mandatoryInstances.forEach((m) => {
      const sId = m.assignment.siteId;
      const sName = m.assignment.site?.name || 'Site';
      if (!siteMap.has(sId)) {
        siteMap.set(sId, {
          siteId: sId,
          siteName: sName,
          employeesCount: 0,
          completedPatrols: 0,
          mandatoryScheduled: 0,
          mandatoryCompleted: 0,
          mandatoryCompliancePct: 0,
          completedCheckpoints: 0,
          requiredCheckpoints: 0,
          incidentsCount: 0,
        });
      }
      const item = siteMap.get(sId);
      item.mandatoryScheduled += 1;
      if (m.status === 'COMPLETED') item.mandatoryCompleted += 1;
    });

    patrolSessions.forEach((p) => {
      if (p.assignment?.siteId) {
        const sId = p.assignment.siteId;
        const sName = p.assignment.site?.name || 'Site';
        if (!siteMap.has(sId)) {
          siteMap.set(sId, {
            siteId: sId,
            siteName: sName,
            employeesCount: 0,
            completedPatrols: 0,
            mandatoryScheduled: 0,
            mandatoryCompleted: 0,
            mandatoryCompliancePct: 0,
            completedCheckpoints: 0,
            requiredCheckpoints: 0,
            incidentsCount: 0,
          });
        }
        const item = siteMap.get(sId);
        if (p.status === 'COMPLETED') item.completedPatrols += 1;

        const reqGates = getSessionRequiredCheckpointsCount(p);
        item.completedCheckpoints += p.checkpoints.length;
        item.requiredCheckpoints += reqGates;
      }
    });

    const siteSummary = Array.from(siteMap.values()).map((s) => ({
      ...s,
      mandatoryCompliancePct:
        s.mandatoryScheduled > 0 ? Math.round((s.mandatoryCompleted / s.mandatoryScheduled) * 100) : 0,
    }));

    // 11. Employee Summary Aggregation (Handle all eligible employees, including those with 0 activity)
    const empMap = new Map<string, any>();

    // Pre-populate with all eligible employees matching the filters
    // Fix: Use employeeModelFilter (id) instead of employeeFilter (employeeId)
    const eligibleEmployees = await prisma.employee.findMany({
      where: {
        ...baseWhereClient,
        status: 'ACTIVE',
        ...roleEmployeeFilter,
        ...(siteId ? { assignments: { some: { siteId, isActive: true } } } : {}),
        ...(shiftId ? { assignments: { some: { shiftId, isActive: true } } } : {}),
        ...employeeModelFilter,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        designation: true,
        assignments: {
          where: {
            isActive: true,
            ...(siteId ? { siteId } : {}),
            ...(shiftId ? { shiftId } : {}),
          },
          include: { site: true, shift: true },
          take: 1,
        },
      },
    });

    eligibleEmployees.forEach((emp) => {
      const eName = `${emp.firstName} ${emp.lastName || ''}`.trim();
      const eRole = formatRoleLabel(emp.role, emp.designation);
      const sName = emp.assignments[0]?.site?.name || siteName || 'Assigned Site';
      empMap.set(emp.id, {
        employeeId: emp.id,
        employeeName: eName,
        employeeRole: eRole,
        siteName: sName,
        completedPatrols: 0,
        patrolDurationSeconds: 0,
        mandatoryScheduled: 0,
        mandatoryCompleted: 0,
        mandatoryCompliancePct: 0,
        checkpointsScanned: 0,
        completedCheckpoints: 0,
        checkpointDurationSeconds: 0,
        incidentsCount: 0,
      });
    });

    mandatoryInstances.forEach((m) => {
      const eId = m.employeeId;
      const eName = `${m.employee.firstName} ${m.employee.lastName || ''}`.trim();
      const eRole = formatRoleLabel(m.employee.role, m.employee.designation);
      const sName = m.assignment?.site?.name || 'Site';
      if (!empMap.has(eId)) {
        empMap.set(eId, {
          employeeId: eId,
          employeeName: eName,
          employeeRole: eRole,
          siteName: sName,
          completedPatrols: 0,
          patrolDurationSeconds: 0,
          mandatoryScheduled: 0,
          mandatoryCompleted: 0,
          mandatoryCompliancePct: 0,
          checkpointsScanned: 0,
          completedCheckpoints: 0,
          checkpointDurationSeconds: 0,
          incidentsCount: 0,
        });
      }
      const item = empMap.get(eId);
      item.mandatoryScheduled += 1;
      if (m.status === 'COMPLETED') item.mandatoryCompleted += 1;
    });

    patrolSessions.forEach((p) => {
      const emp = p.assignment?.employee || p.managerUser?.employee;
      const eId = p.assignment?.employeeId || p.managerUser?.employee?.id;
      if (eId && emp) {
        const eName = `${emp.firstName} ${emp.lastName || ''}`.trim();
        const eRole = formatRoleLabel(emp.role, emp.designation);
        const sName = p.assignment?.site?.name || 'Site';
        if (!empMap.has(eId)) {
          empMap.set(eId, {
            employeeId: eId,
            employeeName: eName,
            employeeRole: eRole,
            siteName: sName,
            completedPatrols: 0,
            patrolDurationSeconds: 0,
            mandatoryScheduled: 0,
            mandatoryCompleted: 0,
            mandatoryCompliancePct: 0,
            checkpointsScanned: 0,
            completedCheckpoints: 0,
            checkpointDurationSeconds: 0,
            incidentsCount: 0,
          });
        }
        const item = empMap.get(eId);
        if (p.status === 'COMPLETED') {
          item.completedPatrols += 1;
          const sOverlap = calculateOverlapDurationSeconds(p.startedAt, p.endedAt, from, to);
          if (sOverlap !== null) {
            item.patrolDurationSeconds += sOverlap;
          }
        }
        item.checkpointsScanned += (p.checkpoints || []).length;
        (p.checkpoints || []).forEach((cp: any) => {
          const timing = resolveCheckpointTiming(cp, timezone);
          if (timing.isCompleted && timing.rawDurationSeconds !== null && cp.scannedAt) {
            const cpStart = new Date(cp.scannedAt);
            const cpEnd = cp.completedAt ? new Date(cp.completedAt) : cpStart;
            const cpOverlap = calculateOverlapDurationSeconds(cpStart, cpEnd, from, to);
            if (cpOverlap !== null) {
              item.completedCheckpoints += 1;
              item.checkpointDurationSeconds += cpOverlap;
            }
          }
        });
      }
    });

    if (employeeId && scopedEmployee && !empMap.has(employeeId)) {
      empMap.set(employeeId, {
        employeeId: scopedEmployee.id,
        employeeName: `${scopedEmployee.firstName} ${scopedEmployee.lastName || ''}`.trim(),
        employeeRole: formatRoleLabel(scopedEmployee.role, scopedEmployee.designation),
        siteName: siteName || 'Assigned Site',
        completedPatrols: 0,
        patrolDurationSeconds: 0,
        mandatoryScheduled: 0,
        mandatoryCompleted: 0,
        mandatoryCompliancePct: 0,
        checkpointsScanned: 0,
        completedCheckpoints: 0,
        checkpointDurationSeconds: 0,
        incidentsCount: 0,
      });
    }

    const employeeSummary = Array.from(empMap.values()).map((e) => ({
      ...e,
      patrolDurationFormatted: formatDurationHuman(e.patrolDurationSeconds),
      checkpointDurationFormatted: formatDurationHuman(e.checkpointDurationSeconds),
      mandatoryCompliancePct:
        e.mandatoryScheduled > 0 ? Math.round((e.mandatoryCompleted / e.mandatoryScheduled) * 100) : 0,
    }));

    // 12. Attendance: Query authoritative Attendance check-in records first, fallback to GuardAssignments
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        ...baseWhereClient,
        attendanceDate: { gte: dateOnlyFrom, lte: dateOnlyTo },
        ...siteFilter,
        ...shiftFilter,
        ...(targetRoleEnum ? { employee: { role: targetRoleEnum } } : {}),
        ...employeeFilter,
      },
      include: {
        employee: true,
        site: true,
        shift: true,
      },
      orderBy: { attendanceDate: 'desc' },
    });

    let attendanceRows: Array<any> = [];

    if (attendanceRecords.length > 0) {
      attendanceRows = attendanceRecords.map((a) => {
        // Genuine face-verified attendance criteria:
        // Must be verified and have valid checkInAt/checkOutAt timestamps.
        const isCheckInVerified = Boolean(
          a.checkInAt &&
          (a.verificationStatus === 'VERIFIED' || a.verificationMethod === 'FACE_VERIFICATION') &&
          a.verificationStatus !== 'PENDING' &&
          a.verificationStatus !== 'FAILED'
        );

        const isCheckOutVerified = Boolean(
          a.checkOutAt &&
          (a.verificationStatus === 'VERIFIED' || a.verificationMethod === 'FACE_VERIFICATION') &&
          a.verificationStatus !== 'PENDING' &&
          a.verificationStatus !== 'FAILED'
        );

        return {
          id: a.id,
          shiftDate: a.attendanceDate.toISOString().split('T')[0],
          employeeName: `${a.employee.firstName} ${a.employee.lastName || ''}`.trim(),
          employeeRole: formatRoleLabel(a.employee.role, a.employee.designation),
          employeeNumber: a.employee.employeeNumber || '—',
          siteName: a.site?.name || 'Monitored Site',
          shiftName: a.shift?.name || 'Shift',
          checkInTime: isCheckInVerified ? formatPatrolDateTime(a.checkInAt, timezone, false) : null,
          checkOutTime: isCheckOutVerified ? formatPatrolDateTime(a.checkOutAt, timezone, false) : null,
          status: a.status || (a.isLate ? 'LATE' : 'PRESENT'),
          isLate: a.isLate,
        };
      });
    } else {
      const assignments = await prisma.guardAssignment.findMany({
        where: {
          ...baseWhereClient,
          effectiveFrom: { lte: to },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
          ...siteFilter,
          ...shiftFilter,
          ...(targetRoleEnum ? { employee: { role: targetRoleEnum } } : {}),
          ...employeeFilter,
        },
        include: {
          employee: true,
          site: true,
          shift: true,
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      attendanceRows = assignments.map((a) => ({
        id: a.id,
        shiftDate: a.effectiveFrom.toISOString().split('T')[0],
        employeeName: `${a.employee.firstName} ${a.employee.lastName || ''}`.trim(),
        employeeRole: formatRoleLabel(a.employee.role, a.employee.designation),
        employeeNumber: a.employee.employeeNumber || '—',
        siteName: a.site.name,
        shiftName: a.shift.name,
        checkInTime: null,
        checkOutTime: null,
        status: a.isActive ? 'PRESENT' : 'OFF',
        isLate: false,
      }));
    }

    const totalCheckpoints = totalRequiredCheckpoints;

    let reportTitle = `Hello Orbit ${periodType.toUpperCase()} Security & Operations Report`;
    if (employeeName) {
      reportTitle = `Hello Orbit ${periodType.toUpperCase()} Employee Operations Report - ${employeeName}`;
    } else if (cleanRoleStr) {
      reportTitle = `Hello Orbit ${periodType.toUpperCase()} ${roleLabel} Operations Report`;
    }

    return {
      metadata: {
        title: reportTitle,
        periodType,
        periodLabel,
        startDate: from.toISOString(),
        endDate: to.toISOString(),
        clientName,
        clientLogoUrl,
        siteName,
        shiftName,
        roleLabel,
        employeeId: scopedEmployee?.id,
        employeeName,
        employeeRole,
        employeeNumber,
        emiratesId: scopedEmployee?.emiratesId ? maskEmiratesId(scopedEmployee.emiratesId) : null,
        generatedAt: new Date().toISOString(),
        timezone: 'Asia/Dubai (GST)',
        includeIncidents,
        isKaizen,
      },
      summary: {
        totalEmployees,
        activeEmployees,
        totalShifts,
        assignedPatrols: patrolSessions.length,
        completedPatrols: completedPatrolsCount,
        incompletePatrols: incompletePatrolsCount,
        additionalPatrols: Math.max(0, completedPatrolsCount - mandatoryCompleted),
        mandatoryScheduled,
        mandatoryCompleted,
        mandatoryMissed,
        mandatoryCompliancePct,
        totalCheckpoints,
        checkpointsScanned: completedCheckpointsCount,
        checkpointsMissed: Math.max(0, totalCheckpoints - completedCheckpointsCount),
        requiredCheckpoints: totalCheckpoints,
        completedCheckpoints: completedCheckpointsCount,
        missedCheckpoints: Math.max(0, totalCheckpoints - completedCheckpointsCount),
        checkpointCompletionPct: totalCheckpoints > 0 ? Math.min(100, Math.round((completedCheckpointsCount / totalCheckpoints) * 100)) : 0,
        incidentsCount: rawIncidents.length,
        // Duration analytics
        totalPatrolDurationSeconds,
        totalPatrolDurationFormatted: formatDurationHuman(totalPatrolDurationSeconds),
        totalCheckpointDurationSeconds,
        totalCheckpointDurationFormatted: formatDurationHuman(totalCheckpointDurationSeconds),
        completedPatrolsCount,
        completedCheckpointsCount,
        avgPatrolDurationSeconds: completedPatrolsCount > 0 ? Math.round(totalPatrolDurationSeconds / completedPatrolsCount) : 0,
        avgPatrolDurationFormatted: completedPatrolsCount > 0 ? formatDurationHuman(Math.round(totalPatrolDurationSeconds / completedPatrolsCount)) : '0 sec',
        avgCheckpointDurationSeconds: completedCheckpointsCount > 0 ? Math.round(totalCheckpointDurationSeconds / completedCheckpointsCount) : 0,
        avgCheckpointDurationFormatted: completedCheckpointsCount > 0 ? formatDurationHuman(Math.round(totalCheckpointDurationSeconds / completedCheckpointsCount)) : '0 sec',
        unavailableDurationsCount: unavailablePatrolDurationsCount + unavailableCheckpointDurationsCount,
        unavailablePatrolDurationsCount,
        unavailableCheckpointDurationsCount,
        untrackedDurationPatrolsCount: unavailablePatrolDurationsCount,
        untrackedDurationCheckpointsCount: unavailableCheckpointDurationsCount,
      },
      dailyBreakdown,
      attendance: attendanceRows,
      patrols: scopedEmployee ? patrolRows : [],
      mandatoryPatrols: mandatoryRows,
      checkpoints: checkpointRows,
      incidents: incidentRows,
      siteSummary,
      employeeSummary,
    };
  }

  /**
   * Retrieves matching completed patrol sessions for a specific employee within an exact reporting period.
   * Ensures 100% numerical consistency with the periodic report's Employee Performance section.
   */
  async getEmployeeCompletedPatrols(params: EmployeePatrolsQueryParams): Promise<EmployeeCompletedPatrolsResult> {
    const authorizedClientIds = await this.resolveAuthorizedClientIds(params);
    const targetClientId = params.clientId && authorizedClientIds.includes(params.clientId)
      ? params.clientId
      : authorizedClientIds[0];

    if (!targetClientId) {
      throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'Valid client ID is required.');
    }

    if (!params.employeeId) {
      throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'Employee ID is required.');
    }

    const client = await prisma.client.findUnique({
      where: { id: targetClientId },
      select: { id: true, companyName: true, clientCode: true, clientLogoUrl: true },
    });

    if (!client) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Client not found.');
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: params.employeeId,
        clientId: targetClientId,
      },
    });

    if (!employee) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Employee not found for this client.');
    }

    const timezone = 'Asia/Dubai';
    const periodRange = this.computeDateRange(params);
    const { from, to, periodLabel, startDateStr, endDateStr } = periodRange;

    const dateWindowFilter = {
      OR: [
        { startedAt: { gte: from, lt: to } },
        { endedAt: { gt: from, lte: to } },
        {
          AND: [
            { startedAt: { lte: from } },
            { endedAt: { gte: to } },
          ],
        },
        {
          AND: [
            { startedAt: { lt: to, gte: new Date(from.getTime() - 24 * 60 * 60 * 1000) } },
            { endedAt: null },
          ],
        },
      ],
    };

    const andFilters: any[] = [dateWindowFilter];
    if (params.role) {
      andFilters.push({
        OR: [
          { assignment: { employee: { role: params.role as any } } },
          { managerUser: { employee: { role: params.role as any } } },
        ],
      });
    }

    const patrolWhere: any = {
      clientId: targetClientId,
      status: 'COMPLETED',
      AND: andFilters,
      OR: [
        { assignment: { employeeId: params.employeeId } },
        { managerUser: { employee: { id: params.employeeId } } },
      ],
      ...(params.siteId || params.shiftId
        ? {
            assignment: {
              ...(params.siteId ? { siteId: params.siteId } : {}),
              ...(params.shiftId ? { shiftId: params.shiftId } : {}),
            },
          }
        : {}),
    };

    // Calculate aggregated metrics over ALL eligible completed patrol sessions for this employee
    const allSessions = await prisma.patrolSession.findMany({
      where: patrolWhere,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        totalDuration: true,
        assignment: {
          select: {
            assignmentType: true,
            patrolRoute: {
              select: {
                routeGates: {
                  select: { gateId: true, gate: { select: { id: true, isActive: true } } },
                },
              },
            },
            assignmentGates: {
              select: { gateId: true, gate: { select: { id: true, isActive: true } } },
            },
          },
        },
        checkpoints: {
          select: {
            id: true,
            gateId: true,
            scannedAt: true,
            completedAt: true,
            status: true,
          },
        },
      },
    });

    const totalCount = allSessions.length;
    let totalPatrolDurationSeconds = 0;
    let totalCheckpointsScanned = 0;
    let totalCheckpointsRequired = 0;

    for (const s of allSessions) {
      const sOverlap = calculateOverlapDurationSeconds(s.startedAt, s.endedAt, from, to);
      if (sOverlap !== null) {
        totalPatrolDurationSeconds += sOverlap;
      }

      const isDirect =
        (s.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
        (!s.assignment?.patrolRoute && (s.assignment?.assignmentGates?.length || 0) > 0);

      const assignedItems = isDirect
        ? (s.assignment?.assignmentGates || [])
        : (s.assignment?.patrolRoute?.routeGates || []);

      const scannedGateIds = new Set((s.checkpoints || []).map((cp) => cp.gateId).filter(Boolean));
      totalCheckpointsScanned += (s.checkpoints || []).length;

      const eligibleGateIds = assignedItems
        .filter((item: any) => {
          const gateId = item.gateId || item.gate?.id;
          if (!gateId) return false;
          const wasScanned = scannedGateIds.has(gateId);
          return isCheckpointEligibleForSession({
            gate: item.gate || { id: gateId, isActive: true },
            session: {
              status: 'COMPLETED',
              startedAt: s.startedAt,
              endedAt: s.endedAt,
              createdAt: s.startedAt,
            },
            isScanned: wasScanned,
            wasScanned,
          });
        })
        .map((item: any) => item.gateId || item.gate?.id);

      const expectedCount = eligibleGateIds.length || (s.checkpoints || []).length || 1;
      totalCheckpointsRequired += expectedCount;
    }

    const averageCompliancePct = totalCheckpointsRequired > 0
      ? Math.round((Math.min(totalCheckpointsScanned, totalCheckpointsRequired) / totalCheckpointsRequired) * 100)
      : 0;

    // Pagination
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const paginatedSessions = await prisma.patrolSession.findMany({
      where: patrolWhere,
      skip,
      take: limit,
      orderBy: {
        [params.sortBy || 'startedAt']: (params.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc') as any,
      },
      include: {
        assignment: {
          include: {
            employee: true,
            site: true,
            shift: true,
            patrolRoute: {
              include: {
                routeGates: {
                  include: { gate: true },
                  orderBy: { sequence: 'asc' },
                },
              },
            },
            assignmentGates: {
              include: { gate: true },
              orderBy: { sequence: 'asc' },
            },
          },
        },
        managerUser: {
          include: { employee: true },
        },
        checkpoints: {
          include: {
            gate: true,
            subTaskResponses: true,
          },
        },
      },
    });

    const transformedPatrols = paginatedSessions.map((s) => {
      const durationSec = calculateOverlapDurationSeconds(s.startedAt, s.endedAt, from, to) || 0;
      const isDirect =
        (s.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
        (!s.assignment?.patrolRoute && (s.assignment?.assignmentGates?.length || 0) > 0);

      const assignedItems = isDirect
        ? (s.assignment?.assignmentGates || [])
        : (s.assignment?.patrolRoute?.routeGates || []);

      const scannedCount = (s.checkpoints || []).length;
      const totalEligibleCount = assignedItems.length || scannedCount || 1;
      const compliance = totalEligibleCount > 0 ? Math.round((scannedCount / totalEligibleCount) * 100) : 0;

      return {
        id: s.id,
        patrolCode: s.patrolCode || s.id,
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt ? s.endedAt.toISOString() : null,
        dateFormatted: formatPatrolDate(s.startedAt, timezone),
        startTimeFormatted: formatPatrolTime(s.startedAt, timezone),
        endTimeFormatted: s.endedAt ? formatPatrolTime(s.endedAt, timezone) : '—',
        siteName: s.assignment?.site?.name || 'N/A',
        routeName: s.assignment?.patrolRoute?.name || 'Manager Inspection',
        shiftName: s.assignment?.shift?.name || 'N/A',
        durationSeconds: durationSec,
        durationFormatted: formatDurationHuman(durationSec),
        scannedCheckpoints: scannedCount,
        totalCheckpoints: totalEligibleCount,
        compliancePct: compliance,
        remarks: s.remarks,
      };
    });

    return {
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
        role: employee.role,
        roleLabel: formatRoleLabel(employee.role, employee.designation),
        designation: employee.designation,
        emiratesId: maskEmiratesId(employee.emiratesId),
      },
      project: {
        id: client.id,
        companyName: client.companyName,
        clientCode: client.clientCode,
        clientLogoUrl: client.clientLogoUrl,
      },
      period: {
        periodType: params.periodType,
        periodLabel,
        startDate: startDateStr,
        endDate: endDateStr,
        timezone,
      },
      filters: {
        shiftId: params.shiftId || null,
        siteId: params.siteId || null,
        role: params.role || null,
      },
      summary: {
        totalCompletedPatrols: totalCount,
        totalPatrolDurationSeconds,
        totalPatrolDurationFormatted: formatDurationHuman(totalPatrolDurationSeconds),
        totalCheckpointsScanned,
        totalCheckpointsRequired,
        averageCompliancePct,
      },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        totalCount,
      },
      patrols: transformedPatrols,
    };
  }
}

export const summaryReportService = new SummaryReportService();


