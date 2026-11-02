import { UserRole } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { attendanceService } from '../attendance.service';
import { attendanceReportService } from '../attendance-report.service';

jest.mock('../../../database/prisma', () => ({
  prisma: {
    client: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    site: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    shift: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    guardAssignment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    attendance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    managerClientMembership: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../modules/notification/notification.service', () => ({
  notificationService: {
    createNotification: jest.fn(),
  },
}));

describe('AttendanceService — Shift Filter & Authoritative Shift Associations', () => {
  const mockUser = {
    id: 'user-manager-1',
    role: 'MANAGER',
    clientId: null,
    tenantId: null,
  };

  const mockClientId = 'client-kaizen-1';
  const mockDayShiftId = 'shift-day-1';
  const mockNightShiftId = 'shift-night-2';

  const mockDayShift = {
    id: mockDayShiftId,
    clientId: mockClientId,
    name: 'Day Shift',
    shiftCode: 'SH-DAY-001',
    startTime: '08:00',
    endTime: '20:00',
    isActive: true,
  };

  const mockNightShift = {
    id: mockNightShiftId,
    clientId: mockClientId,
    name: 'Night Shift',
    shiftCode: 'SH-NGT-002',
    startTime: '20:00',
    endTime: '08:00',
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.managerClientMembership.findMany as jest.Mock).mockResolvedValue([
      { clientId: mockClientId },
    ]);

    (prisma.client.findFirst as jest.Mock).mockResolvedValue({
      id: mockClientId,
      companyName: 'KAIZEN - PENINSULA 1',
      clientLogoUrl: null,
    });

    (prisma.client.findUnique as jest.Mock).mockResolvedValue({
      id: mockClientId,
      companyName: 'KAIZEN - PENINSULA 1',
      clientLogoUrl: null,
    });

    (prisma.shift.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.id === mockDayShiftId) return Promise.resolve(mockDayShift);
      if (where.id === mockNightShiftId) return Promise.resolve(mockNightShift);
      if (where.id === 'shift-foreign') {
        return Promise.resolve({
          id: 'shift-foreign',
          clientId: 'client-other',
          name: 'Other Client Shift',
          startTime: '09:00',
          endTime: '17:00',
        });
      }
      return Promise.resolve(null);
    });
  });

  it('1. filters attendance records strictly by selected shiftId and sets metrics', async () => {
    const mockEmployee = {
      id: 'emp-1',
      clientId: mockClientId,
      firstName: 'Ahmed',
      lastName: 'Ali',
      role: 'SECURITY',
      employeeNumber: 'SEC-101',
      status: 'ACTIVE',
      assignments: [
        {
          id: 'asg-1',
          isActive: true,
          shiftId: mockDayShiftId,
          siteId: 'site-1',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          site: { id: 'site-1', name: 'Main Gate' },
          shift: mockDayShift,
          patrolSessions: [],
        },
      ],
    };

    const mockAttendanceRecord = {
      id: 'att-1',
      clientId: mockClientId,
      employeeId: 'emp-1',
      siteId: 'site-1',
      shiftId: mockDayShiftId,
      attendanceDate: new Date('2026-10-30'),
      checkInAt: new Date('2026-10-30T08:00:00.000Z'),
      checkOutAt: new Date('2026-10-30T20:00:00.000Z'),
      status: 'COMPLETED',
      isLate: false,
      verificationMethod: 'FACE_VERIFICATION',
      verificationStatus: 'VERIFIED',
      site: { id: 'site-1', name: 'Main Gate' },
      shift: mockDayShift,
      employee: mockEmployee,
    };

    (prisma.employee.findMany as jest.Mock).mockResolvedValue([mockEmployee]);
    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([mockAttendanceRecord]);
    (prisma.employee.count as jest.Mock).mockResolvedValue(1);

    const result = await attendanceService.listAttendance(mockUser, {
      clientId: mockClientId,
      shiftId: mockDayShiftId,
      date: '2026-10-30',
    });

    expect(prisma.shift.findUnique).toHaveBeenCalledWith({
      where: { id: mockDayShiftId },
      select: expect.objectContaining({ name: true }),
    });

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ shiftId: mockDayShiftId }, { assignment: { shiftId: mockDayShiftId } }],
        }),
      }),
    );

    expect(result.records.length).toBe(1);
    expect(result.records[0].shiftId).toBe(mockDayShiftId);
    expect(result.records[0].shiftName).toBe('Day Shift');
    expect(result.metrics.totalCompleted).toBe(1);
  });

  it('2. throws FORBIDDEN error when an unauthorized shiftId is requested', async () => {
    await expect(
      attendanceService.listAttendance(mockUser, {
        clientId: mockClientId,
        shiftId: 'shift-foreign',
        date: '2026-10-30',
      }),
    ).rejects.toThrow('Unauthorized shift attendance access requested.');
  });

  it('3. filters by both shiftId and role together correctly', async () => {
    (prisma.employee.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.employee.count as jest.Mock).mockResolvedValue(0);

    const result = await attendanceService.listAttendance(mockUser, {
      clientId: mockClientId,
      shiftId: mockDayShiftId,
      role: 'SECURITY',
      date: '2026-10-30',
    });

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: { role: 'SECURITY' },
          OR: [{ shiftId: mockDayShiftId }, { assignment: { shiftId: mockDayShiftId } }],
        }),
      }),
    );

    expect(result.records.length).toBe(0);
    expect(result.pagination.total).toBe(0);
  });

  it('4. prioritizes authoritative historical shiftId on the attendance record over employee current active assignment', async () => {
    // Employee was on Day Shift historically, but their CURRENT active assignment has been changed to Night Shift
    const employeeWithNewShift = {
      id: 'emp-2',
      clientId: mockClientId,
      firstName: 'Zayd',
      lastName: 'Hassan',
      role: 'SECURITY',
      employeeNumber: 'SEC-102',
      status: 'ACTIVE',
      assignments: [
        {
          id: 'asg-new',
          isActive: true,
          shiftId: mockNightShiftId, // CURRENT ACTIVE SHIFT IS NIGHT
          siteId: 'site-1',
          effectiveFrom: new Date('2026-11-01'),
          effectiveTo: null,
          site: { id: 'site-1', name: 'Main Gate' },
          shift: mockNightShift,
          patrolSessions: [],
        },
      ],
    };

    // Historical attendance record specifically logged for Day Shift on 2026-10-25
    const historicalDayAttendance = {
      id: 'att-hist-1',
      clientId: mockClientId,
      employeeId: 'emp-2',
      siteId: 'site-1',
      shiftId: mockDayShiftId, // HISTORICAL RECORD SHIFT IS DAY
      attendanceDate: new Date('2026-10-25'),
      checkInAt: new Date('2026-10-25T08:00:00.000Z'),
      checkOutAt: new Date('2026-10-25T20:00:00.000Z'),
      status: 'COMPLETED',
      isLate: false,
      verificationMethod: 'FACE_VERIFICATION',
      verificationStatus: 'VERIFIED',
      site: { id: 'site-1', name: 'Main Gate' },
      shift: mockDayShift,
      employee: employeeWithNewShift,
    };

    (prisma.employee.findMany as jest.Mock).mockResolvedValue([employeeWithNewShift]);
    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([historicalDayAttendance]);
    (prisma.employee.count as jest.Mock).mockResolvedValue(1);

    const result = await attendanceService.listAttendance(mockUser, {
      clientId: mockClientId,
      shiftId: mockDayShiftId,
      date: '2026-10-25',
    });

    expect(result.records.length).toBe(1);
    // Must report Day Shift (authoritative from attendance record), NOT the current active Night Shift
    expect(result.records[0].shiftId).toBe(mockDayShiftId);
    expect(result.records[0].shiftName).toBe('Day Shift');
  });

  it('5. handles overnight shift spanning midnight without duplicate records', async () => {
    const employeeOvernight = {
      id: 'emp-night-1',
      clientId: mockClientId,
      firstName: 'Tariq',
      lastName: 'Mahmood',
      role: 'SECURITY',
      employeeNumber: 'SEC-103',
      status: 'ACTIVE',
      assignments: [
        {
          id: 'asg-ngt',
          isActive: true,
          shiftId: mockNightShiftId,
          siteId: 'site-1',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          site: { id: 'site-1', name: 'Main Gate' },
          shift: mockNightShift,
          patrolSessions: [],
        },
      ],
    };

    // Overnight shift check-in at 20:00 on Oct 30, checkout at 08:00 on Oct 31, business date Oct 30
    const overnightAttendance = {
      id: 'att-night-1',
      clientId: mockClientId,
      employeeId: 'emp-night-1',
      siteId: 'site-1',
      shiftId: mockNightShiftId,
      attendanceDate: new Date('2026-10-30'),
      checkInAt: new Date('2026-10-30T20:00:00.000Z'),
      checkOutAt: new Date('2026-10-31T08:00:00.000Z'),
      status: 'COMPLETED',
      isLate: false,
      verificationMethod: 'FACE_VERIFICATION',
      verificationStatus: 'VERIFIED',
      site: { id: 'site-1', name: 'Main Gate' },
      shift: mockNightShift,
      employee: employeeOvernight,
    };

    (prisma.employee.findMany as jest.Mock).mockResolvedValue([employeeOvernight]);
    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([overnightAttendance]);
    (prisma.employee.count as jest.Mock).mockResolvedValue(1);

    const result = await attendanceService.listAttendance(mockUser, {
      clientId: mockClientId,
      shiftId: mockNightShiftId,
      date: '2026-10-30',
    });

    expect(result.records.length).toBe(1);
    expect(result.records[0].shiftId).toBe(mockNightShiftId);
    expect(result.records[0].shiftName).toBe('Night Shift');
    expect(result.records[0].status).toBe('COMPLETED');
    expect(result.records[0].workingDurationMins).toBe(720); // 12 hours
  });

  it('6. exports attendance report and includes shift filter in metadata for Excel and PDF', async () => {
    const mockEmployee = {
      id: 'emp-1',
      clientId: mockClientId,
      firstName: 'Ahmed',
      lastName: 'Ali',
      role: 'SECURITY',
      employeeNumber: 'SEC-101',
      status: 'ACTIVE',
      assignments: [
        {
          id: 'asg-1',
          isActive: true,
          shiftId: mockDayShiftId,
          siteId: 'site-1',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          site: { id: 'site-1', name: 'Main Gate' },
          shift: mockDayShift,
          patrolSessions: [],
        },
      ],
    };

    const mockAttendanceRecord = {
      id: 'att-1',
      clientId: mockClientId,
      employeeId: 'emp-1',
      siteId: 'site-1',
      shiftId: mockDayShiftId,
      attendanceDate: new Date('2026-10-30'),
      checkInAt: new Date('2026-10-30T08:00:00.000Z'),
      checkOutAt: new Date('2026-10-30T20:00:00.000Z'),
      status: 'COMPLETED',
      isLate: false,
      verificationMethod: 'FACE_VERIFICATION',
      verificationStatus: 'VERIFIED',
      site: { id: 'site-1', name: 'Main Gate' },
      shift: mockDayShift,
      employee: mockEmployee,
    };

    (prisma.employee.findMany as jest.Mock).mockResolvedValue([mockEmployee]);
    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([mockAttendanceRecord]);
    (prisma.employee.count as jest.Mock).mockResolvedValue(1);

    const excelSpy = jest.spyOn(attendanceReportService, 'generateAttendanceExcel');

    const result = await attendanceService.exportAttendanceReport(
      mockUser,
      {
        clientId: mockClientId,
        shiftId: mockDayShiftId,
        date: '2026-10-30',
      },
      'excel',
    );

    expect(excelSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        shiftFilter: 'Day Shift (08:00 - 20:00)',
      }),
    );

    expect(result.filename).toContain('HelloOrbit_Attendance_Report_2026-10-30.xlsx');
  });
});
