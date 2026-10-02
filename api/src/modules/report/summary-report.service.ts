import { prisma } from '../../database/prisma';
import { assertCentralManagerClientAccess } from '../../common/auth/central-manager-auth';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { formatPatrolDateTime } from '../../common/utils/date-formatter.util';

export type ReportPeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface SummaryReportParams {
  periodType: ReportPeriodType;
  date?: string; // YYYY-MM-DD
  week?: string; // YYYY-MM-DD or YYYY-Wxx
  month?: string; // YYYY-MM
  startDate?: string;
  endDate?: string;
  clientId?: string;
  siteId?: string;
  employeeId?: string;
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
    siteName?: string;
    employeeName?: string;
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
    requiredCheckpoints: number;
    completedCheckpoints: number;
    missedCheckpoints: number;
    checkpointCompletionPct: number;
    incidentsCount: number;
  };
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
    mandatoryScheduled: number;
    mandatoryCompleted: number;
    mandatoryCompliancePct: number;
    checkpointsScanned: number;
    incidentsCount: number;
  }>;
}

export class SummaryReportService {
  /**
   * Computes authoritative date range for DAILY, WEEKLY, or MONTHLY period types.
   */
  private computeDateRange(params: SummaryReportParams): { from: Date; to: Date; periodLabel: string } {
    const { periodType, date, month, startDate, endDate } = params;

    let from: Date;
    let to: Date;
    let periodLabel = '';

    if (startDate && endDate) {
      from = new Date(startDate);
      to = new Date(endDate);
      if (endDate.length <= 10) {
        to.setHours(23, 59, 59, 999);
      }
      periodLabel = `${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}`;
      return { from, to, periodLabel };
    }

    const parseDateParts = (dateStr?: string) => {
      if (dateStr && dateStr.includes('-')) {
        const parts = dateStr.split('-').map(Number);
        return { year: parts[0], monthIdx: parts[1] - 1, day: parts[2] || 1 };
      }
      const now = new Date();
      return { year: now.getFullYear(), monthIdx: now.getMonth(), day: now.getDate() };
    };

    if (periodType === 'DAILY') {
      const { year, monthIdx, day } = parseDateParts(date);
      from = new Date(year, monthIdx, day, 0, 0, 0, 0);
      to = new Date(year, monthIdx, day, 23, 59, 59, 999);
      periodLabel = from.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    } else if (periodType === 'WEEKLY') {
      const { year, monthIdx, day } = parseDateParts(date);
      const refDate = new Date(year, monthIdx, day, 12, 0, 0, 0);
      const dayOfWeek = refDate.getDay(); // 0 is Sunday
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      from = new Date(year, monthIdx, day + diffToMonday, 0, 0, 0, 0);
      to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59, 999);
      periodLabel = `Week of ${from.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    } else {
      // MONTHLY
      let year = new Date().getFullYear();
      let monthIdx = new Date().getMonth();

      if (month && month.includes('-')) {
        const parts = month.split('-');
        year = parseInt(parts[0], 10);
        monthIdx = parseInt(parts[1], 10) - 1;
      } else if (date && date.includes('-')) {
        const parts = date.split('-');
        year = parseInt(parts[0], 10);
        monthIdx = parseInt(parts[1], 10) - 1;
      }

      from = new Date(year, monthIdx, 1, 0, 0, 0, 0);
      to = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
      periodLabel = from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    return { from, to, periodLabel };
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
    const { from, to, periodLabel } = this.computeDateRange(params);
    const { siteId, employeeId, periodType } = params;
    const timezone = 'Asia/Dubai';

    // Fetch Client info
    const client = await prisma.client.findFirst({
      where: { id: { in: clientIds } },
      select: { companyName: true, clientCode: true },
    });
    const clientName = client?.companyName || 'Security Services Client';
    const isKaizen = clientName.toLowerCase().includes('kaizen');
    const includeIncidents = !isKaizen;

    let siteName: string | undefined;
    if (siteId) {
      const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } });
      siteName = site?.name;
    }

    let employeeName: string | undefined;
    if (employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true },
      });
      if (emp) employeeName = `${emp.firstName} ${emp.lastName || ''}`.trim();
    }

    // Build base query filters
    const baseWhereClient = { clientId: { in: clientIds } };
    const siteFilter = siteId ? { siteId } : {};
    const employeeFilter = employeeId ? { employeeId } : {};

    // 1. Employees query
    const [totalEmployees, activeEmployees] = await Promise.all([
      prisma.employee.count({
        where: { ...baseWhereClient, ...employeeFilter },
      }),
      prisma.employee.count({
        where: { ...baseWhereClient, status: 'ACTIVE', ...employeeFilter },
      }),
    ]);

    // 2. Shifts & Assignments count
    const totalShifts = await prisma.shift.count({
      where: { ...baseWhereClient, isActive: true },
    });

    // 3. Patrol Sessions query with full relations
    const patrolSessions = await prisma.patrolSession.findMany({
      where: {
        ...baseWhereClient,
        startedAt: { gte: from, lte: to },
        ...(siteId ? { assignment: { siteId } } : {}),
        ...(employeeId ? { assignment: { employeeId } } : {}),
      },
      include: {
        assignment: {
          include: {
            employee: true,
            site: true,
            shift: true,
            patrolRoute: {
              include: {
                routeGates: true,
              },
            },
            assignmentGates: true,
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

    const completedPatrolsCount = patrolSessions.filter((p) => p.status === 'COMPLETED').length;
    const incompletePatrolsCount = patrolSessions.filter((p) => p.status !== 'COMPLETED').length;

    // 4. Mandatory Patrol Instances query
    const mandatoryInstances = await prisma.mandatoryPatrolInstance.findMany({
      where: {
        ...baseWhereClient,
        shiftDate: { gte: from, lte: to },
        ...(siteId ? { assignment: { siteId } } : {}),
        ...employeeFilter,
      },
      include: {
        employee: true,
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
      mandatoryScheduled > 0 ? Math.round((mandatoryCompleted / mandatoryScheduled) * 100) : 100;

    // 5. Checkpoints & Incidents
    const totalScannedCheckpoints = patrolSessions.reduce((acc, p) => acc + p.checkpoints.length, 0);

    let totalRequiredCheckpoints = 0;
    patrolSessions.forEach((p) => {
      const isDirect =
        (p.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
        (!p.assignment?.patrolRoute && (p.assignment?.assignmentGates?.length || 0) > 0);

      const reqGates = p.managerUserId
        ? p.checkpoints.length
        : isDirect
        ? p.assignment?.assignmentGates?.length || 0
        : p.assignment?.patrolRoute?.routeGates?.length || 0;

      totalRequiredCheckpoints += reqGates > 0 ? reqGates : p.checkpoints.length;
    });

    const checkpointCompletionPct =
      totalRequiredCheckpoints > 0 ? Math.round((totalScannedCheckpoints / totalRequiredCheckpoints) * 100) : 100;

    const incidentSiteFilter = siteId
      ? { OR: [{ patrolSession: { assignment: { siteId } } }, { gate: { siteId } }] }
      : {};

    const rawIncidents = includeIncidents
      ? await prisma.incident.findMany({
          where: {
            ...baseWhereClient,
            createdAt: { gte: from, lte: to },
            ...incidentSiteFilter,
            ...employeeFilter,
          },
          include: {
            employee: true,
            patrolSession: {
              include: {
                assignment: {
                  include: {
                    site: true,
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

    // 6. Map Patrol Rows
    const patrolRows = patrolSessions.map((p) => {
      const emp = p.assignment?.employee || p.managerUser?.employee;
      const guardName = emp
        ? `${emp.firstName} ${emp.lastName || ''}`.trim()
        : p.managerUser?.email || 'Officer';
      const employeeRole = formatRoleLabel(emp?.role, emp?.designation);
      const employeeCode = emp?.employeeNumber || '—';

      const isDirect =
        (p.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
        (!p.assignment?.patrolRoute && (p.assignment?.assignmentGates?.length || 0) > 0);

      const expectedGatesCount = p.managerUserId
        ? p.checkpoints.length
        : isDirect
        ? p.assignment?.assignmentGates?.length || 0
        : p.assignment?.patrolRoute?.routeGates?.length || 0;

      const checkpointsRequired = expectedGatesCount > 0 ? expectedGatesCount : p.checkpoints.length;
      const checkpointsCompleted = p.checkpoints.length;

      const startedAtFormatted = formatPatrolDateTime(p.startedAt, timezone, false);
      const completedAtFormatted = p.endedAt ? formatPatrolDateTime(p.endedAt, timezone, false) : null;

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
        durationMins: p.totalDuration ? Math.round(p.totalDuration / 60) : 0,
        status: p.status,
        checkpointsCompleted,
        checkpointsRequired,
        checkpointCount: checkpointsCompleted,
        checkpointsDisplay: `${checkpointsCompleted} / ${checkpointsRequired}`,
      };
    });

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
        shiftName: m.assignment?.shift?.name || 'Shift',
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
          mandatoryCompliancePct: 100,
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
            mandatoryCompliancePct: 100,
            completedCheckpoints: 0,
            requiredCheckpoints: 0,
            incidentsCount: 0,
          });
        }
        const item = siteMap.get(sId);
        if (p.status === 'COMPLETED') item.completedPatrols += 1;

        const isDirect =
          (p.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
          (!p.assignment?.patrolRoute && (p.assignment?.assignmentGates?.length || 0) > 0);
        const reqGates = p.managerUserId
          ? p.checkpoints.length
          : isDirect
          ? p.assignment?.assignmentGates?.length || 0
          : p.assignment?.patrolRoute?.routeGates?.length || 0;

        item.completedCheckpoints += p.checkpoints.length;
        item.requiredCheckpoints += reqGates > 0 ? reqGates : p.checkpoints.length;
      }
    });

    const siteSummary = Array.from(siteMap.values()).map((s) => ({
      ...s,
      mandatoryCompliancePct:
        s.mandatoryScheduled > 0 ? Math.round((s.mandatoryCompleted / s.mandatoryScheduled) * 100) : 100,
    }));

    // 11. Employee Summary Aggregation
    const empMap = new Map<string, any>();
    mandatoryInstances.forEach((m) => {
      const eId = m.employeeId;
      const eName = `${m.employee.firstName} ${m.employee.lastName || ''}`.trim();
      const eRole = formatRoleLabel(m.employee.role, m.employee.designation);
      const sName = m.assignment.site?.name || 'Site';
      if (!empMap.has(eId)) {
        empMap.set(eId, {
          employeeId: eId,
          employeeName: eName,
          employeeRole: eRole,
          siteName: sName,
          completedPatrols: 0,
          mandatoryScheduled: 0,
          mandatoryCompleted: 0,
          mandatoryCompliancePct: 100,
          checkpointsScanned: 0,
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
            mandatoryScheduled: 0,
            mandatoryCompleted: 0,
            mandatoryCompliancePct: 100,
            checkpointsScanned: 0,
            incidentsCount: 0,
          });
        }
        const item = empMap.get(eId);
        if (p.status === 'COMPLETED') item.completedPatrols += 1;
        item.checkpointsScanned += p.checkpoints.length;
      }
    });

    const employeeSummary = Array.from(empMap.values()).map((e) => ({
      ...e,
      mandatoryCompliancePct:
        e.mandatoryScheduled > 0 ? Math.round((e.mandatoryCompleted / e.mandatoryScheduled) * 100) : 100,
    }));

    // 12. Attendance Rows from GuardAssignments
    const assignments = await prisma.guardAssignment.findMany({
      where: {
        ...baseWhereClient,
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
        ...siteFilter,
        ...employeeFilter,
      },
      include: {
        employee: true,
        site: true,
        shift: true,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const attendanceRows = assignments.map((a) => ({
      id: a.id,
      shiftDate: a.effectiveFrom.toISOString().split('T')[0],
      employeeName: `${a.employee.firstName} ${a.employee.lastName || ''}`.trim(),
      employeeRole: formatRoleLabel(a.employee.role, a.employee.designation),
      employeeNumber: a.employee.employeeNumber || '—',
      siteName: a.site.name,
      shiftName: a.shift.name,
      checkInTime: formatPatrolDateTime(a.effectiveFrom, timezone, false),
      checkOutTime: a.effectiveTo ? formatPatrolDateTime(a.effectiveTo, timezone, false) : null,
      status: a.isActive ? 'PRESENT' : 'OFF',
      isLate: false,
    }));

    return {
      metadata: {
        title: `Hello Orbit ${periodType.toUpperCase()} Security & Operations Report`,
        periodType,
        periodLabel,
        startDate: from.toISOString(),
        endDate: to.toISOString(),
        clientName,
        siteName,
        employeeName,
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
        requiredCheckpoints: totalRequiredCheckpoints,
        completedCheckpoints: totalScannedCheckpoints,
        missedCheckpoints: Math.max(0, totalRequiredCheckpoints - totalScannedCheckpoints),
        checkpointCompletionPct,
        incidentsCount: rawIncidents.length,
      },
      attendance: attendanceRows,
      patrols: patrolRows,
      mandatoryPatrols: mandatoryRows,
      checkpoints: checkpointRows,
      incidents: incidentRows,
      siteSummary,
      employeeSummary,
    };
  }
}

export const summaryReportService = new SummaryReportService();

