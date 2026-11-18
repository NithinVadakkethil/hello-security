import { UserRole } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { attendanceService } from '../attendance.service';

jest.mock('../../../database/prisma', () => ({
  prisma: {
    client: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
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

describe('AttendanceService — Night Shift & Cross-Midnight Lifecycle', () => {
  const mockUser = {
    id: 'user-admin-1',
    role: UserRole.CLIENT_ADMIN,
    tenantId: 'client-kaizen-1',
  };

  const mockClientId = 'client-kaizen-1';
  const mockSiteId = 'site-marina-101';
  const mockEmployeeId = 'emp-jithin-1';

  const mockNightShift = {
    id: 'shift-night-1',
    clientId: mockClientId,
    name: 'Night Shift (10 PM - 9 AM)',
    shiftCode: 'SH-NGT-101',
    startTime: '22:00',
    endTime: '09:00',
    isActive: true,
  };

  const mockDayShift = {
    id: 'shift-day-1',
    clientId: mockClientId,
    name: 'Day Shift (9 AM - 6 PM)',
    shiftCode: 'SH-DAY-101',
    startTime: '09:00',
    endTime: '18:00',
    isActive: true,
  };

  const mockAssignment: any = {
    id: 'asg-night-1',
    clientId: mockClientId,
    employeeId: mockEmployeeId,
    siteId: mockSiteId,
    shiftId: mockNightShift.id,
    isActive: true,
    site: { id: mockSiteId, name: 'Marina 101 Tower' },
    shift: mockNightShift,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
  };

  const mockEmployee: any = {
    id: mockEmployeeId,
    clientId: mockClientId,
    firstName: 'Jithin',
    lastName: 'Kumar',
    employeeNumber: 'EMP-00101',
    role: 'SECURITY_GUARD',
    designation: 'Security Guard',
    status: 'ACTIVE',
    assignments: [mockAssignment],
  };

  mockAssignment.employee = mockEmployee;

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.client.findUnique as jest.Mock).mockResolvedValue({
      id: mockClientId,
      companyName: 'KAIZEN Asset Management',
    });

    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(mockEmployee);
  });

  describe('Scenario 1: Pre-midnight Check-in for Night Shift', () => {
    it('accurately resolves shift occurrence starting on Nov 12 when checking in at 21:55', async () => {
      // 21:55 Dubai (+4) = 17:55 UTC
      const fakeNow = new Date('2026-11-12T17:55:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fakeNow);

      (prisma.attendance.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // active in-progress check
        .mockResolvedValueOnce(null); // existing date record check

      (prisma.attendance.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'att-session-1',
          ...data,
          site: { name: 'Marina 101 Tower' },
          shift: mockNightShift,
          assignment: mockAssignment,
        }),
      );

      const result = await attendanceService.recordCheckIn(mockUser, {
        employeeId: mockEmployeeId,
        assignmentId: mockAssignment.id,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('PRESENT');
      expect(result.isLate).toBe(false);
      expect(result.shiftDate).toBe('2026-11-12');

      expect(prisma.attendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: mockEmployeeId,
            attendanceDate: new Date(Date.UTC(2026, 10, 12, 0, 0, 0, 0)),
            status: 'PRESENT',
            isLate: false,
          }),
        }),
      );

      jest.useRealTimers();
    });
  });

  describe('Scenario 2: State Persistence Across Midnight (Post-Midnight Query)', () => {
    it('returns the active checked-in shift at 02:30 AM without requiring check-in again', async () => {
      // 02:30 AM Dubai time on Nov 13 = Nov 12 22:30 UTC
      const fakeNow = new Date('2026-11-12T22:30:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fakeNow);

      const activeRecord = {
        id: 'att-session-1',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        attendanceDate: new Date(Date.UTC(2026, 10, 12, 0, 0, 0, 0)),
        checkInAt: new Date('2026-11-12T17:55:00.000Z'),
        checkOutAt: null,
        status: 'PRESENT',
        isLate: false,
        verificationMethod: 'FACE_VERIFICATION',
        verificationStatus: 'VERIFIED',
        site: { name: 'Marina 101 Tower' },
        shift: mockNightShift,
        assignment: mockAssignment,
      };

      (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.guardAssignment.findUnique as jest.Mock).mockResolvedValueOnce(mockAssignment);
      (prisma.attendance.findFirst as jest.Mock).mockResolvedValueOnce(activeRecord);

      const result = await attendanceService.getAttendanceById(mockUser, mockAssignment.id);

      expect(result).toBeDefined();
      expect(result.status).toBe('PRESENT');
      expect(result.checkInTimeRaw).toBe('2026-11-12T17:55:00.000Z');
      expect(result.checkOutTimeRaw).toBeNull();
      expect(result.shiftDate).toBe('2026-11-12');
      expect(result.workingDurationMins).toBeGreaterThan(260);

      jest.useRealTimers();
    });
  });

  describe('Scenario 3: Duplicate Check-in Prevention During Active Shift', () => {
    it('rejects duplicate check-in attempts at 02:35 AM while shift is already in progress', async () => {
      const fakeNow = new Date('2026-11-12T22:35:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fakeNow);

      const activeRecord = {
        id: 'att-session-1',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        shiftId: mockNightShift.id,
        attendanceDate: new Date(Date.UTC(2026, 10, 12, 0, 0, 0, 0)),
        checkInAt: new Date('2026-11-12T17:55:00.000Z'),
        checkOutAt: null,
      };

      (prisma.attendance.findFirst as jest.Mock).mockResolvedValueOnce(activeRecord);

      await expect(
        attendanceService.recordCheckIn(mockUser, {
          employeeId: mockEmployeeId,
          assignmentId: mockAssignment.id,
        }),
      ).rejects.toThrow('Employee is already checked in for this shift');

      jest.useRealTimers();
    });
  });

  describe('Scenario 4: Morning Check-Out Across Midnight', () => {
    it('seamlessly checks out at 09:05 AM on Nov 13 without creating duplicate records', async () => {
      // 09:05 AM Dubai time on Nov 13 = Nov 13 05:05 UTC
      const fakeNow = new Date('2026-11-13T05:05:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fakeNow);

      const activeRecord = {
        id: 'att-session-1',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        shiftId: mockNightShift.id,
        attendanceDate: new Date(Date.UTC(2026, 10, 12, 0, 0, 0, 0)),
        checkInAt: new Date('2026-11-12T17:55:00.000Z'),
        checkOutAt: null,
        status: 'PRESENT',
        isLate: false,
        verificationMethod: 'FACE_VERIFICATION',
        verificationStatus: 'VERIFIED',
        site: { name: 'Marina 101 Tower' },
        shift: mockNightShift,
        assignment: mockAssignment,
      };

      (prisma.attendance.findFirst as jest.Mock).mockResolvedValueOnce(activeRecord);

      (prisma.attendance.update as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          ...activeRecord,
          ...data,
          site: { name: 'Marina 101 Tower' },
          shift: mockNightShift,
          assignment: mockAssignment,
        }),
      );

      const result = await attendanceService.recordCheckOut(mockUser, {
        employeeId: mockEmployeeId,
        assignmentId: mockAssignment.id,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(result.checkInTimeRaw).toBe('2026-11-12T17:55:00.000Z');
      expect(result.checkOutTimeRaw).toBe('2026-11-13T05:05:00.000Z');
      expect(result.shiftDate).toBe('2026-11-12');
      // Duration: 21:55 Nov 12 to 09:05 Nov 13 = 11h 10m = 670 minutes
      expect(result.workingDurationMins).toBe(670);
      expect(result.workingDuration).toContain('11h 10m');

      expect(prisma.attendance.create).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('Scenario 5: Duplicate Check-Out Prevention', () => {
    it('rejects duplicate check-out attempts after shift is already completed', async () => {
      const fakeNow = new Date('2026-11-13T05:10:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fakeNow);

      const completedRecord = {
        id: 'att-session-1',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        shiftId: mockNightShift.id,
        attendanceDate: new Date(Date.UTC(2026, 10, 12, 0, 0, 0, 0)),
        checkInAt: new Date('2026-11-12T17:55:00.000Z'),
        checkOutAt: new Date('2026-11-13T05:05:00.000Z'),
        status: 'COMPLETED',
        verificationMethod: 'FACE_VERIFICATION',
        verificationStatus: 'VERIFIED',
      };

      (prisma.attendance.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(completedRecord);

      await expect(
        attendanceService.recordCheckOut(mockUser, {
          employeeId: mockEmployeeId,
          assignmentId: mockAssignment.id,
        }),
      ).rejects.toThrow('Attendance for this shift has already been checked out');

      jest.useRealTimers();
    });
  });

  describe('Scenario 6: Late Check-In Detection for Night Shift', () => {
    it('marks attendance as LATE when check-in is 20 minutes after shift start time', async () => {
      // 22:20 Dubai time on Nov 12 = 18:20 UTC
      const fakeNow = new Date('2026-11-12T18:20:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fakeNow);

      (prisma.attendance.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      (prisma.attendance.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'att-session-late',
          ...data,
          site: { name: 'Marina 101 Tower' },
          shift: mockNightShift,
          assignment: mockAssignment,
        }),
      );

      const result = await attendanceService.recordCheckIn(mockUser, {
        employeeId: mockEmployeeId,
        assignmentId: mockAssignment.id,
      });

      expect(result.status).toBe('LATE');
      expect(result.isLate).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Scenario 7: Day Shift Standard Lifecycle', () => {
    it('executes clean check-in and check-out on the same calendar day', async () => {
      const dayAssignment = {
        ...mockAssignment,
        id: 'asg-day-1',
        shiftId: mockDayShift.id,
        shift: mockDayShift,
      };
      const dayEmployee = {
        ...mockEmployee,
        assignments: [dayAssignment],
      };
      dayAssignment.employee = dayEmployee;

      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(dayEmployee);

      // Check-in at 08:50 Dubai time = 04:50 UTC
      const checkInTime = new Date('2026-11-12T04:50:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(checkInTime);

      (prisma.attendance.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      (prisma.attendance.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'att-day-1',
          ...data,
          site: { name: 'Marina 101 Tower' },
          shift: mockDayShift,
          assignment: dayAssignment,
        }),
      );

      const checkInResult = await attendanceService.recordCheckIn(mockUser, {
        employeeId: mockEmployeeId,
        assignmentId: 'asg-day-1',
      });

      expect(checkInResult.status).toBe('PRESENT');
      expect(checkInResult.isLate).toBe(false);
      expect(checkInResult.shiftDate).toBe('2026-11-12');

      // Check-out at 18:10 Dubai time = 14:10 UTC
      const checkOutTime = new Date('2026-11-12T14:10:00.000Z');
      jest.setSystemTime(checkOutTime);

      const activeDayRecord = {
        id: 'att-day-1',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        shiftId: mockDayShift.id,
        attendanceDate: new Date(Date.UTC(2026, 10, 12, 0, 0, 0, 0)),
        checkInAt: checkInTime,
        checkOutAt: null,
        verificationMethod: 'FACE_VERIFICATION',
        verificationStatus: 'VERIFIED',
        site: { name: 'Marina 101 Tower' },
        shift: mockDayShift,
        assignment: dayAssignment,
      };

      (prisma.attendance.findFirst as jest.Mock).mockResolvedValueOnce(activeDayRecord);
      (prisma.attendance.update as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          ...activeDayRecord,
          ...data,
        }),
      );

      const checkOutResult = await attendanceService.recordCheckOut(mockUser, {
        employeeId: mockEmployeeId,
        assignmentId: 'asg-day-1',
      });

      expect(checkOutResult.status).toBe('COMPLETED');
      // 08:50 to 18:10 = 9h 20m = 560 mins
      expect(checkOutResult.workingDurationMins).toBe(560);
      expect(checkOutResult.workingDuration).toContain('9h 20m');

      jest.useRealTimers();
    });
  });

  describe('Scenario 8: Independence from Patrol Activities', () => {
    it('verifies that attendance operates completely independent of patrol sessions', async () => {
      const fakeNow = new Date('2026-11-12T17:55:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fakeNow);

      (prisma.attendance.findFirst as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      (prisma.attendance.create as jest.Mock).mockResolvedValue({
        id: 'att-session-indep',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        attendanceDate: new Date(Date.UTC(2026, 10, 12, 0, 0, 0, 0)),
        checkInAt: fakeNow,
        status: 'PRESENT',
        isLate: false,
        verificationMethod: 'FACE_VERIFICATION',
        verificationStatus: 'VERIFIED',
      });

      const res = await attendanceService.recordCheckIn(mockUser, {
        employeeId: mockEmployeeId,
      });

      expect(res.verificationMethod).toBe('FACE_VERIFICATION');
      expect((prisma as any).patrolSession?.findMany).toBeUndefined();

      jest.useRealTimers();
    });
  });
});
