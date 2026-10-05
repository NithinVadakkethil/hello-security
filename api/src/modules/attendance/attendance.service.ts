import { UserRole } from '@prisma/client';
import { assertCentralManagerClientAccess } from '../../common/auth/central-manager-auth';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { formatPatrolDateTime } from '../../common/utils/date-formatter.util';
import { prisma } from '../../database/prisma';
import { attendanceReportService, AttendanceReportMetadata } from './attendance-report.service';
import { notificationService } from '../notification/notification.service';
import {
  AttendanceFilterQueryDto,
  AttendanceListResponseDto,
  AttendanceRecordDto,
} from './attendance.types';

const ROLE_LABELS: Record<string, string> = {
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

function formatRoleLabel(role?: string | null, designation?: string | null): string {
  if (designation && designation.trim()) {
    const dLower = designation.trim().toLowerCase();
    if (dLower === 'security' || dLower === 'security guard' || dLower === 'guard') {
      return 'Security Guard';
    }
    return designation.trim();
  }
  if (!role) return 'Security Guard';
  return ROLE_LABELS[role.toUpperCase()] || role.replace(/_/g, ' ');
}

export class AttendanceService {
  /**
   * Resolves authorized Client IDs for request.
   */
  private async resolveAuthorizedClientIds(
    user: { id: string; role: string; tenantId?: string | null },
    targetClientId?: string,
  ): Promise<string[]> {
    if (
      user.role === UserRole.CLIENT_ADMIN ||
      user.role === UserRole.SECURITY ||
      user.role === UserRole.SUPERVISOR ||
      user.role === UserRole.TECHNICIAN ||
      user.role === UserRole.CLEANER ||
      user.role === UserRole.SERVICE_ENGINEER ||
      user.role === UserRole.LIFE_GUARD ||
      user.role === UserRole.PLUMBER
    ) {
      const authClientId = user.tenantId;
      if (!authClientId) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'User has no assigned Client ID.');
      }
      if (targetClientId && targetClientId !== authClientId) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized client access requested.');
      }
      return [authClientId];
    } else if (user.role === UserRole.SUPER_ADMIN) {
      if (targetClientId) return [targetClientId];
      const allClients = await prisma.client.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      return allClients.map((c) => c.id);
    } else {
      // Centralized Manager / Manager
      return assertCentralManagerClientAccess(user as any, targetClientId);
    }
  }

  /**
   * Parses date range for filtering attendance records.
   */
  private parseDateRange(query: AttendanceFilterQueryDto): { from: Date; to: Date; dateStr: string } {
    const now = new Date();
    let targetDate = query.date;

    if (query.datePreset) {
      const p = query.datePreset.toLowerCase();
      if (p === 'today') {
        const d = new Date();
        targetDate = d.toISOString().split('T')[0];
      } else if (p === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        targetDate = d.toISOString().split('T')[0];
      } else if (p === 'this_week') {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(d.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const from = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
        const to = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
        return { from, to, dateStr: `${monday.toISOString().split('T')[0]} to ${sunday.toISOString().split('T')[0]}` };
      } else if (p === 'this_month') {
        const d = new Date();
        const from = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
        const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        return { from, to, dateStr: `${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}` };
      } else if (p === 'all') {
        const from = new Date(2020, 0, 1, 0, 0, 0, 0);
        const to = new Date(2030, 11, 31, 23, 59, 59, 999);
        return { from, to, dateStr: 'All Time' };
      }
    }

    if (query.startDate && query.endDate) {
      const [sY, sM, sD] = query.startDate.split('-').map(Number);
      const [eY, eM, eD] = query.endDate.split('-').map(Number);
      const from = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
      const to = new Date(eY, eM - 1, eD, 23, 59, 59, 999);
      return { from, to, dateStr: `${query.startDate} to ${query.endDate}` };
    }

    if (targetDate && targetDate.includes('-')) {
      const [year, month, day] = targetDate.split('-').map(Number);
      const from = new Date(year, month - 1, day, 0, 0, 0, 0);
      const to = new Date(year, month - 1, day, 23, 59, 59, 999);
      return { from, to, dateStr: targetDate };
    }

    // Default to today
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const from = new Date(y, m, d, 0, 0, 0, 0);
    const to = new Date(y, m, d, 23, 59, 59, 999);
    const dateStr = now.toISOString().split('T')[0];
    return { from, to, dateStr };
  }

  /**
   * Helper to compute duration string from minutes.
   */
  private formatDuration(minutes: number, isOngoing: boolean = false): string {
    if (minutes <= 0) return isOngoing ? '0m (Active)' : '0m';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    const timeStr = hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : ''}`.trim() : `${mins}m`;
    return isOngoing ? `${timeStr} (Active)` : timeStr;
  }

  /**
   * Maps a single employee, their assignments, and authoritative Attendance DB record
   * to ONE AttendanceRecordDto.
   *
   * CRITICAL REQUIREMENT:
   * Timestamps MUST come exclusively from successful face-verified attendance check-in/checkout.
   * Patrol sessions and mandatory patrol timestamps MUST NEVER populate check-in/check-out fields.
   */
  private mapEmployeeToAttendanceRecord(
    employee: any,
    employeeAssignments: any[],
    dateStr: string,
    timezone: string = 'Asia/Dubai',
    attendanceRecord?: any | null,
  ): AttendanceRecordDto {
    const empName = `${employee.firstName} ${employee.lastName || ''}`.trim();
    const empRole = formatRoleLabel(employee.role, employee.designation);
    const shiftDate = dateStr.includes('to')
      ? (employeeAssignments[0]?.effectiveFrom ? employeeAssignments[0].effectiveFrom.toISOString().split('T')[0] : dateStr)
      : dateStr;

    // Collect patrol sessions across assignments only for informational counts
    const allSessions: any[] = [];
    for (const a of employeeAssignments) {
      if (Array.isArray(a.patrolSessions)) {
        allSessions.push(...a.patrolSessions);
      }
    }

    let checkInDate: Date | null = null;
    let checkOutDate: Date | null = null;
    let status: 'PRESENT' | 'LATE' | 'OFF' | 'COMPLETED' = 'OFF';
    let isLate = false;

    if (attendanceRecord && attendanceRecord.checkInAt) {
      checkInDate = new Date(attendanceRecord.checkInAt);
      checkOutDate = attendanceRecord.checkOutAt ? new Date(attendanceRecord.checkOutAt) : null;
      isLate = Boolean(attendanceRecord.isLate);

      if (checkOutDate) {
        status = 'COMPLETED';
      } else if (attendanceRecord.status === 'LATE' || isLate) {
        status = 'LATE';
      } else {
        status = 'PRESENT';
      }
    } else {
      // No attendance marked for this date -> strictly OFF, null timestamps
      status = 'OFF';
      checkInDate = null;
      checkOutDate = null;
      isLate = false;
    }

    // Determine check-in / check-out formatted strings
    const checkInFormatted = checkInDate ? formatPatrolDateTime(checkInDate, timezone, false) : null;
    const checkOutFormatted = checkOutDate ? formatPatrolDateTime(checkOutDate, timezone, false) : null;

    // Pick primary assignment for site/shift info
    const primaryAssignment =
      employeeAssignments.find((a) => a.isActive && a.site && a.shift) ||
      employeeAssignments.find((a) => a.site) ||
      employeeAssignments[0] ||
      null;

    // Calculate working duration from actual attendance timestamps
    let durationMins = 0;
    let workingDuration: string | null = null;

    if (checkInDate) {
      if (checkOutDate) {
        durationMins = Math.max(0, (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60));
        workingDuration = this.formatDuration(durationMins, false);
      } else {
        durationMins = Math.max(0, (Date.now() - checkInDate.getTime()) / (1000 * 60));
        workingDuration = this.formatDuration(durationMins, true);
      }
    }

    const completedPatrols = allSessions.filter((p) => p.status === 'COMPLETED').length;

    return {
      id: attendanceRecord?.id || (primaryAssignment ? primaryAssignment.id : `att_${employee.id}_${shiftDate}`),
      assignmentId: primaryAssignment ? primaryAssignment.id : `att_${employee.id}_${shiftDate}`,
      employeeId: employee.id,
      employeeName: empName,
      employeeRole: empRole,
      employeeNumber: employee.employeeNumber || '—',
      employeePhoto: employee.photo,
      employeeEmail: employee.email,
      employeePhone: employee.phone,
      employeeDesignation: employee.designation,
      siteId: primaryAssignment?.siteId || attendanceRecord?.siteId || '',
      siteName: primaryAssignment?.site?.name || attendanceRecord?.site?.name || (attendanceRecord?.checkInAt ? 'Direct Check-In' : 'Unassigned'),
      siteAddress: primaryAssignment?.site?.address || attendanceRecord?.site?.address || null,
      shiftId: primaryAssignment?.shiftId || attendanceRecord?.shiftId || '',
      shiftName: primaryAssignment?.shift?.name || attendanceRecord?.shift?.name || (attendanceRecord?.checkInAt ? 'General Shift' : 'Unassigned'),
      shiftStartTime: primaryAssignment?.shift?.startTime || attendanceRecord?.shift?.startTime || '—',
      shiftEndTime: primaryAssignment?.shift?.endTime || attendanceRecord?.shift?.endTime || '—',
      shiftDate,
      date: shiftDate,
      employeeCode: employee.employeeNumber || undefined,
      checkInTime: checkInFormatted,
      checkInTimeRaw: checkInDate ? checkInDate.toISOString() : null,
      checkOutTime: checkOutFormatted,
      checkOutTimeRaw: checkOutDate ? checkOutDate.toISOString() : null,
      status,
      isLate,
      workingDuration: workingDuration || (status === 'OFF' ? '—' : '0m'),
      workingDurationMins: Math.round(durationMins),
      verificationMethod: attendanceRecord?.verificationMethod || 'FACE_VERIFICATION',
      verificationStatus: checkInDate ? 'VERIFIED' : 'PENDING',
      patrolSessionsCount: allSessions.length,
      completedPatrolsCount: completedPatrols,
      assignmentType: primaryAssignment?.assignmentType || 'ROUTE',
      createdAt: (attendanceRecord?.createdAt || employee.createdAt).toISOString(),
      updatedAt: (attendanceRecord?.updatedAt || employee.updatedAt).toISOString(),
    };
  }

  /**
   * Internal query method: Queries database for attendance records and employee assignments.
   */
  private async queryFilteredAssignments(
    user: { id: string; role: string; tenantId?: string | null },
    query: AttendanceFilterQueryDto,
  ) {
    const authorizedClientIds = await this.resolveAuthorizedClientIds(user, query.clientId);
    const { from, to, dateStr } = this.parseDateRange(query);
    const timezone = 'Asia/Dubai';

    // Normalize employeeId filter
    const rawEmployeeId = query.employeeId;
    const employeeId =
      rawEmployeeId &&
      typeof rawEmployeeId === 'string' &&
      rawEmployeeId.trim() !== '' &&
      rawEmployeeId.toLowerCase() !== 'all' &&
      rawEmployeeId.toLowerCase() !== 'null' &&
      rawEmployeeId.toLowerCase() !== 'undefined'
        ? rawEmployeeId.trim()
        : undefined;

    // Verify employeeId access if passed
    if (employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { clientId: true },
      });
      if (!emp || !authorizedClientIds.includes(emp.clientId)) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized employee attendance access requested.');
      }
    }

    // Verify siteId access if passed
    if (query.siteId) {
      const site = await prisma.site.findUnique({
        where: { id: query.siteId },
        select: { clientId: true },
      });
      if (!site || !authorizedClientIds.includes(site.clientId)) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized site attendance access requested.');
      }
    }

    // Build employee query
    const employeeWhere: any = {
      clientId: { in: authorizedClientIds },
      status: 'ACTIVE',
      ...(employeeId ? { id: employeeId } : {}),
    };

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      employeeWhere.AND = [
        {
          OR: [
            { firstName: { contains: s, mode: 'insensitive' } },
            { lastName: { contains: s, mode: 'insensitive' } },
            { employeeNumber: { contains: s, mode: 'insensitive' } },
            { email: { contains: s, mode: 'insensitive' } },
            { phone: { contains: s, mode: 'insensitive' } },
            { companyName: { contains: s, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Query employees, database attendance records, and active staff count in parallel
    const [allEmployees, attendanceRecords, activeStaffCount] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        include: {
          assignments: {
            where: {
              isActive: true,
              effectiveFrom: { lte: to },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
              ...(query.siteId ? { siteId: query.siteId } : {}),
            },
            include: {
              site: true,
              shift: true,
              patrolSessions: {
                where: {
                  startedAt: { gte: from, lte: to },
                },
                select: {
                  id: true,
                  status: true,
                  startedAt: true,
                  endedAt: true,
                },
              },
            },
            orderBy: { effectiveFrom: 'desc' },
          },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.attendance.findMany({
        where: {
          clientId: { in: authorizedClientIds },
          attendanceDate: {
            gte: from,
            lte: to,
          },
          ...(employeeId ? { employeeId } : {}),
          ...(query.siteId ? { siteId: query.siteId } : {}),
        },
        include: {
          site: true,
          shift: true,
          employee: {
            include: {
              assignments: {
                where: { isActive: true },
                include: { site: true, shift: true },
              },
            },
          },
        },
      }),
      prisma.employee.count({
        where: {
          clientId: { in: authorizedClientIds },
          status: 'ACTIVE',
        },
      }),
    ]);

    const isRangeQuery = dateStr.includes('to') || dateStr === 'All Time';
    const mappedRecords: AttendanceRecordDto[] = [];

    if (!isRangeQuery) {
      // Single-day query
      const attendanceMap = new Map<string, any>();
      for (const att of attendanceRecords) {
        const attDateStr = att.attendanceDate.toISOString().split('T')[0];
        attendanceMap.set(`${att.employeeId}_${attDateStr}`, att);
        attendanceMap.set(att.employeeId, att);
      }

      const employeeMap = new Map<string, { employee: any; assignments: any[] }>();

      for (const emp of allEmployees) {
        const attRecord = attendanceMap.get(`${emp.id}_${dateStr}`) || attendanceMap.get(emp.id);
        if (query.siteId && emp.assignments.length === 0 && attRecord?.siteId !== query.siteId) {
          continue;
        }
        employeeMap.set(emp.id, {
          employee: emp,
          assignments: emp.assignments || [],
        });
      }

      for (const att of attendanceRecords) {
        if (!employeeMap.has(att.employeeId) && att.employee) {
          employeeMap.set(att.employeeId, {
            employee: att.employee,
            assignments: att.employee.assignments || [],
          });
        }
      }

      for (const [, { employee, assignments }] of employeeMap.entries()) {
        const attRecord = attendanceMap.get(`${employee.id}_${dateStr}`) || attendanceMap.get(employee.id) || null;
        const record = this.mapEmployeeToAttendanceRecord(employee, assignments, dateStr, timezone, attRecord);
        mappedRecords.push(record);
      }
    } else {
      // Date range or all-time query
      const seenEmployeesInAttendance = new Set<string>();

      // 1. Map each real attendance record found in this range
      for (const att of attendanceRecords) {
        if (query.siteId && att.siteId !== query.siteId) {
          continue;
        }
        const emp = allEmployees.find((e) => e.id === att.employeeId) || att.employee;
        if (!emp) continue;
        const attDateStr = att.attendanceDate.toISOString().split('T')[0];
        const record = this.mapEmployeeToAttendanceRecord(emp, emp.assignments || [], attDateStr, timezone, att);
        mappedRecords.push(record);
        seenEmployeesInAttendance.add(emp.id);
      }

      // 2. For employees without attendance records in this range, include their baseline status
      for (const emp of allEmployees) {
        if (!seenEmployeesInAttendance.has(emp.id)) {
          if (query.siteId && emp.assignments.length === 0) {
            continue;
          }
          const record = this.mapEmployeeToAttendanceRecord(emp, emp.assignments || [], dateStr, timezone, null);
          mappedRecords.push(record);
        }
      }
    }

    // Filter by status if specified
    const filteredRecords =
      query.status && query.status !== 'ALL'
        ? mappedRecords.filter((r) => r.status === query.status)
        : mappedRecords;

    return {
      authorizedClientIds,
      dateStr,
      from,
      to,
      timezone,
      mappedRecords,
      filteredRecords,
      activeStaffCount,
    };
  }

  /**
   * Lists paginated attendance records.
   */
  async listAttendance(
    user: { id: string; role: string; tenantId?: string | null },
    query: AttendanceFilterQueryDto,
  ): Promise<AttendanceListResponseDto> {
    const { filteredRecords, activeStaffCount } = await this.queryFilteredAssignments(user, query);

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(1000, Number(query.limit || 15)));
    const skip = (page - 1) * limit;

    // Calculate metrics based on the filtered dataset
    const totalPresent = filteredRecords.filter((r) => r.status === 'PRESENT').length;
    const totalLate = filteredRecords.filter((r) => r.status === 'LATE').length;
    const totalCompleted = filteredRecords.filter((r) => r.status === 'COMPLETED').length;
    const totalOff = filteredRecords.filter((r) => r.status === 'OFF').length;
    const totalCheckedIn = filteredRecords.filter(
      (r) => Boolean(r.checkInTimeRaw || (r.checkInTime && r.checkInTime !== '—')),
    ).length;

    // Apply pagination
    const total = filteredRecords.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedRecords = filteredRecords.slice(skip, skip + limit);

    return {
      records: paginatedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      metrics: {
        totalCheckedIn,
        totalPresent,
        totalLate,
        totalCompleted,
        totalOff,
        totalActiveStaff: activeStaffCount,
      },
    };
  }

  /**
   * Retrieves single attendance record details by assignment ID, Attendance ID, or Employee ID.
   */
  async getAttendanceById(
    user: { id: string; role: string; tenantId?: string | null },
    recordId: string,
  ): Promise<AttendanceRecordDto> {
    const todayStr = new Date().toISOString().split('T')[0];
    const [bYear, bMonth, bDay] = todayStr.split('-').map(Number);
    const todayDate = new Date(Date.UTC(bYear, bMonth - 1, bDay, 0, 0, 0, 0));

    // 1. Try finding by Attendance ID
    const directAttendance = await prisma.attendance.findUnique({
      where: { id: recordId },
      include: {
        employee: {
          include: {
            assignments: {
              where: { isActive: true },
              include: { site: true, shift: true },
            },
          },
        },
      },
    });

    if (directAttendance) {
      const authorizedClientIds = await this.resolveAuthorizedClientIds(user, directAttendance.clientId);
      if (!authorizedClientIds.includes(directAttendance.clientId)) {
        throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized attendance record access.');
      }
      return this.mapEmployeeToAttendanceRecord(
        directAttendance.employee,
        directAttendance.employee.assignments,
        directAttendance.attendanceDate.toISOString().split('T')[0],
        'Asia/Dubai',
        directAttendance,
      );
    }

    // 2. Try finding by GuardAssignment ID
    let assignment: any = await prisma.guardAssignment.findUnique({
      where: { id: recordId },
      include: {
        employee: true,
        site: true,
        shift: true,
      },
    });

    let employee: any = assignment?.employee;

    // 3. If not found by assignmentId, try finding by employeeId
    if (!assignment) {
      const emp = await prisma.employee.findUnique({
        where: { id: recordId },
        include: {
          assignments: {
            where: { isActive: true },
            include: { site: true, shift: true },
          },
        },
      });

      if (!emp) {
        throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Attendance record not found.');
      }
      employee = emp;
      assignment = emp.assignments[0] || null;
    }

    if (!employee) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Attendance record not found.');
    }

    const authorizedClientIds = await this.resolveAuthorizedClientIds(user, employee.clientId);
    if (!authorizedClientIds.includes(employee.clientId)) {
      throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized attendance record access.');
    }

    // Query existing attendance for this employee on today's business date
    const attRecord = await prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate: todayDate,
        },
      },
    });

    const assignments = (employee as any).assignments || (assignment ? [assignment] : []);
    return this.mapEmployeeToAttendanceRecord(employee, assignments, todayStr, 'Asia/Dubai', attRecord);
  }

  /**
   * Authoritative face-verified check-in endpoint handler.
   * Enforces: ONE check-in per employee per business date.
   *
   * Server timestamp is authoritative (new Date()).
   */
  async recordCheckIn(
    user: { id: string; role: string; tenantId?: string | null },
    params: {
      employeeId: string;
      assignmentId?: string;
      siteId?: string;
      shiftId?: string;
      businessDate?: string;
    },
  ): Promise<AttendanceRecordDto> {
    const serverTimestamp = new Date();
    const businessDateStr = params.businessDate || serverTimestamp.toISOString().split('T')[0];
    const [bYear, bMonth, bDay] = businessDateStr.split('-').map(Number);
    const businessDate = new Date(Date.UTC(bYear, bMonth - 1, bDay, 0, 0, 0, 0));

    // Find active employee
    const employee = await prisma.employee.findUnique({
      where: { id: params.employeeId },
      include: {
        assignments: {
          where: { isActive: true },
          include: { site: true, shift: true },
        },
      },
    });

    if (!employee) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Employee not found.');
    }

    const authorizedClientIds = await this.resolveAuthorizedClientIds(user, employee.clientId);
    if (!authorizedClientIds.includes(employee.clientId)) {
      throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized employee check-in requested.');
    }

    // Check existing attendance record in database
    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate: businessDate,
        },
      },
    });

    if (existing) {
      if (existing.checkOutAt) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'ATTENDANCE_ALREADY_COMPLETED',
          'Attendance for this business date is already completed. Next check-in is allowed on the next business date.',
        );
      }
      if (existing.checkInAt) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'ATTENDANCE_ALREADY_CHECKED_IN',
          'Employee is already checked in for this business date.',
        );
      }
    }

    const primaryAssignment =
      employee.assignments.find((a) => a.id === params.assignmentId) ||
      employee.assignments.find((a) => a.site && a.shift) ||
      employee.assignments[0] ||
      null;

    // Calculate late status against shift start time + 15 min grace period
    let isLate = false;
    if (primaryAssignment?.shift?.startTime) {
      const [shHours, shMins] = primaryAssignment.shift.startTime.split(':').map(Number);
      if (!isNaN(shHours) && !isNaN(shMins)) {
        const shiftStartOnDate = new Date(serverTimestamp);
        shiftStartOnDate.setHours(shHours, shMins + 15, 0, 0); // 15 mins grace period
        if (serverTimestamp > shiftStartOnDate) {
          isLate = true;
        }
      }
    }

    const status = isLate ? 'LATE' : 'PRESENT';

    const attendanceRecord = await prisma.attendance.upsert({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate: businessDate,
        },
      },
      update: {
        checkInAt: serverTimestamp,
        status,
        isLate,
        siteId: primaryAssignment?.siteId || params.siteId || null,
        shiftId: primaryAssignment?.shiftId || params.shiftId || null,
        assignmentId: primaryAssignment?.id || params.assignmentId || null,
      },
      create: {
        clientId: employee.clientId,
        employeeId: employee.id,
        attendanceDate: businessDate,
        checkInAt: serverTimestamp,
        status,
        isLate,
        siteId: primaryAssignment?.siteId || params.siteId || null,
        shiftId: primaryAssignment?.shiftId || params.shiftId || null,
        assignmentId: primaryAssignment?.id || params.assignmentId || null,
        verificationMethod: 'FACE_VERIFICATION',
        verificationStatus: 'VERIFIED',
      },
    });

    const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
    const siteName = primaryAssignment?.site?.name || 'Assigned Site';
    const shiftName = primaryAssignment?.shift?.name || 'Assigned Shift';

    try {
      await notificationService.createNotification({
        clientId: employee.clientId,
        type: 'EMPLOYEE_CHECKED_IN',
        title: 'Employee checked in',
        message: `${employeeName} checked in at ${siteName}.`,
        entityType: 'Attendance',
        entityId: attendanceRecord.id,
        metadata: {
          employeeId: employee.id,
          employeeName,
          employeeRole: formatRoleLabel(employee.role, employee.designation),
          clientId: employee.clientId,
          siteId: attendanceRecord.siteId,
          siteName,
          shiftId: attendanceRecord.shiftId,
          shiftName,
          checkInAt: attendanceRecord.checkInAt,
          attendanceId: attendanceRecord.id,
        },
        idempotencyKey: `EMPLOYEE_CHECKED_IN_${attendanceRecord.id}`,
      });
    } catch (err: any) {
      console.error(`Failed to create check-in notification: ${err.message}`);
    }

    return this.mapEmployeeToAttendanceRecord(employee, employee.assignments, businessDateStr, 'Asia/Dubai', attendanceRecord);
  }

  /**
   * Authoritative face-verified checkout endpoint handler.
   * Enforces: ONE checkout per employee per business date.
   *
   * Server timestamp is authoritative (new Date()).
   */
  async recordCheckOut(
    user: { id: string; role: string; tenantId?: string | null },
    params: {
      employeeId: string;
      assignmentId?: string;
      businessDate?: string;
    },
  ): Promise<AttendanceRecordDto> {
    const serverTimestamp = new Date();
    const businessDateStr = params.businessDate || serverTimestamp.toISOString().split('T')[0];
    const [bYear, bMonth, bDay] = businessDateStr.split('-').map(Number);
    const businessDate = new Date(Date.UTC(bYear, bMonth - 1, bDay, 0, 0, 0, 0));

    const employee = await prisma.employee.findUnique({
      where: { id: params.employeeId },
      include: {
        assignments: {
          where: { isActive: true },
          include: { site: true, shift: true },
        },
      },
    });

    if (!employee) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Employee not found.');
    }

    const authorizedClientIds = await this.resolveAuthorizedClientIds(user, employee.clientId);
    if (!authorizedClientIds.includes(employee.clientId)) {
      throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Unauthorized employee checkout requested.');
    }

    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate: businessDate,
        },
      },
    });

    if (existing?.checkOutAt) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'ATTENDANCE_ALREADY_COMPLETED',
        'Attendance for this business date has already been checked out.',
      );
    }

    const primaryAssignment = employee.assignments[0] || null;

    let attendanceRecord;
    if (existing) {
      attendanceRecord = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkOutAt: serverTimestamp,
          status: 'COMPLETED',
        },
      });
    } else {
      attendanceRecord = await prisma.attendance.create({
        data: {
          clientId: employee.clientId,
          employeeId: employee.id,
          attendanceDate: businessDate,
          checkInAt: serverTimestamp,
          checkOutAt: serverTimestamp,
          status: 'COMPLETED',
          isLate: false,
          siteId: primaryAssignment?.siteId,
          shiftId: primaryAssignment?.shiftId,
          assignmentId: primaryAssignment?.id,
          verificationMethod: 'FACE_VERIFICATION',
          verificationStatus: 'VERIFIED',
        },
      });
    }

    const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
    const siteName = primaryAssignment?.site?.name || 'Assigned Site';
    const shiftName = primaryAssignment?.shift?.name || 'Assigned Shift';

    const checkIn = attendanceRecord.checkInAt ? new Date(attendanceRecord.checkInAt) : null;
    const checkOut = attendanceRecord.checkOutAt ? new Date(attendanceRecord.checkOutAt) : new Date();
    const workingDurationMins = checkIn
      ? Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000))
      : 0;
    const durationHours = Math.floor(workingDurationMins / 60);
    const durationMinsRemainder = workingDurationMins % 60;
    const workingDurationStr = `${durationHours}h ${durationMinsRemainder}m`;

    try {
      await notificationService.createNotification({
        clientId: employee.clientId,
        type: 'EMPLOYEE_CHECKED_OUT',
        title: 'Employee checked out',
        message: `${employeeName} checked out from ${siteName}.`,
        entityType: 'Attendance',
        entityId: attendanceRecord.id,
        metadata: {
          employeeId: employee.id,
          employeeName,
          employeeRole: formatRoleLabel(employee.role, employee.designation),
          clientId: employee.clientId,
          siteId: attendanceRecord.siteId,
          siteName,
          shiftId: attendanceRecord.shiftId,
          shiftName,
          checkInAt: attendanceRecord.checkInAt,
          checkOutAt: attendanceRecord.checkOutAt,
          workingDuration: workingDurationStr,
          attendanceId: attendanceRecord.id,
        },
        idempotencyKey: `EMPLOYEE_CHECKED_OUT_${attendanceRecord.id}`,
      });
    } catch (err: any) {
      console.error(`Failed to create check-out notification: ${err.message}`);
    }

    return this.mapEmployeeToAttendanceRecord(employee, employee.assignments, businessDateStr, 'Asia/Dubai', attendanceRecord);
  }

  /**
   * Exports attendance report matching the exact filter criteria (PDF or Excel)
   */
  async exportAttendanceReport(
    user: { id: string; role: string; tenantId?: string | null },
    query: AttendanceFilterQueryDto,
    format: 'pdf' | 'excel' = 'pdf',
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const { filteredRecords, dateStr, authorizedClientIds } = await this.queryFilteredAssignments(user, query);

    // Get metadata for client/site/employee
    let clientName: string | undefined;
    if (query.clientId) {
      const client = await prisma.client.findUnique({ where: { id: query.clientId }, select: { companyName: true } });
      clientName = client?.companyName;
    } else if (authorizedClientIds.length === 1) {
      const client = await prisma.client.findUnique({ where: { id: authorizedClientIds[0] }, select: { companyName: true } });
      clientName = client?.companyName;
    }

    let siteName: string | undefined;
    if (query.siteId) {
      const site = await prisma.site.findUnique({ where: { id: query.siteId }, select: { name: true } });
      siteName = site?.name;
    }

    let employeeName: string | undefined;
    let employeeRole: string | undefined;
    let employeeNumber: string | undefined;
    if (query.employeeId && query.employeeId !== 'ALL') {
      const emp = await prisma.employee.findUnique({
        where: { id: query.employeeId },
        select: { firstName: true, lastName: true, role: true, designation: true, employeeNumber: true },
      });
      if (emp) {
        employeeName = `${emp.firstName} ${emp.lastName || ''}`.trim();
        employeeRole = formatRoleLabel(emp.role, emp.designation);
        employeeNumber = emp.employeeNumber || undefined;
      }
    }

    const metadata: AttendanceReportMetadata = {
      title: 'ATTENDANCE REPORT',
      clientName,
      siteName,
      employeeName,
      employeeRole,
      employeeNumber,
      dateStr,
      statusFilter: query.status && query.status !== 'ALL' ? query.status : undefined,
      generatedAt: formatPatrolDateTime(new Date(), 'Asia/Dubai', true),
      timezone: 'Asia/Dubai',
    };

    const cleanDateStr = dateStr.replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseFilename = `HelloOrbit_Attendance_Report_${cleanDateStr}`;

    if (format === 'excel') {
      const buffer = attendanceReportService.generateAttendanceExcel(filteredRecords, metadata);
      return {
        buffer,
        filename: `${baseFilename}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } else {
      const buffer = await attendanceReportService.generateAttendancePdf(filteredRecords, metadata);
      return {
        buffer,
        filename: `${baseFilename}.pdf`,
        mimeType: 'application/pdf',
      };
    }
  }
}

export const attendanceService = new AttendanceService();
