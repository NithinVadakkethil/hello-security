import { UserRole } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { summaryReportService } from '../summary-report.service';
import { excelGeneratorService } from '../excel-generator.service';
import { pdfGeneratorService } from '../pdf-generator.service';
import { calculateOverlapDurationSeconds, formatDurationHuman } from '../../../common/utils/date-formatter.util';

jest.mock('../../../database/prisma', () => ({
  prisma: {
    client: {
      findFirst: jest.fn(),
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
      findMany: jest.fn(),
    },
    patrolSession: {
      findMany: jest.fn(),
    },
    mandatoryPatrolInstance: {
      findMany: jest.fn(),
    },
    attendance: {
      findMany: jest.fn(),
    },
    incident: {
      findMany: jest.fn(),
    },
    checkpointInspection: {
      findMany: jest.fn(),
    },
    managerClientMembership: {
      findMany: jest.fn(),
    },
  },
}));

describe('SummaryReportService - Duration Analytics, Shift-First Filtering & Regression Tests', () => {
  const mockClientId = 'client_kaizen_01';
  const mockSiteId = 'site_dubai_hub';
  const mockShiftId = 'shift_day_01';
  const mockEmployeeId = 'emp_guard_01';

  const mockUser = {
    id: 'usr_admin',
    role: UserRole.MANAGER,
    clientId: null,
    tenantId: null,
  };

  const mockClient = {
    id: mockClientId,
    companyName: 'Kaizen Properties',
    clientCode: 'KZN',
    clientLogoUrl: 'https://cdn.orbit.com/logo.png',
  };

  const mockEmployee = {
    id: mockEmployeeId,
    clientId: mockClientId,
    firstName: 'Ahmed',
    lastName: 'Khan',
    employeeNumber: 'EMP-001',
    role: 'SECURITY',
    designation: 'Security Guard',
    status: 'ACTIVE',
    assignments: [
      {
        id: 'asg_1',
        siteId: mockSiteId,
        shiftId: mockShiftId,
        isActive: true,
        site: { name: 'Dubai Hub' },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.managerClientMembership.findMany as jest.Mock).mockResolvedValue([
      { clientId: mockClientId, isActive: true },
    ]);
    (prisma.client.findFirst as jest.Mock).mockResolvedValue(mockClient);
    (prisma.employee.count as jest.Mock).mockResolvedValue(1);
    (prisma.employee.findMany as jest.Mock).mockResolvedValue([mockEmployee]);
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(mockEmployee);
    (prisma.shift.count as jest.Mock).mockResolvedValue(1);
    (prisma.shift.findMany as jest.Mock).mockResolvedValue([
      { id: mockShiftId, name: 'Day Shift', startTime: '08:00', endTime: '16:00', clientId: mockClientId },
    ]);
    (prisma.shift.findUnique as jest.Mock).mockResolvedValue({
      id: mockShiftId,
      name: 'Day Shift',
      clientId: mockClientId,
    });
    (prisma.site.findUnique as jest.Mock).mockResolvedValue({
      id: mockSiteId,
      name: 'Dubai Hub',
      clientId: mockClientId,
    });
    (prisma.site.findMany as jest.Mock).mockResolvedValue([
      { id: mockSiteId, name: 'Dubai Hub', clientId: mockClientId },
    ]);
    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.incident.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.mandatoryPatrolInstance.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.guardAssignment.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('Task 1 — Fix Report-Generation Prisma Query (employee.findMany)', () => {
    it('1. should pass { id: employeeId } to employee.findMany and NOT { employeeId }', async () => {
      (prisma.patrolSession.findMany as jest.Mock).mockResolvedValue([]);

      await summaryReportService.generateReportDataset({
        periodType: 'DAILY',
        date: '2026-10-28',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        user: mockUser as any,
      });

      expect(prisma.employee.findMany).toHaveBeenCalled();
      const callArg = (prisma.employee.findMany as jest.Mock).mock.calls[0][0];
      expect(callArg.where).toHaveProperty('id', mockEmployeeId);
      expect(callArg.where).not.toHaveProperty('employeeId');
    });

    it('2. should return a valid empty report without server error when 0 employees match', async () => {
      (prisma.employee.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.employee.count as jest.Mock).mockResolvedValue(0);
      (prisma.patrolSession.findMany as jest.Mock).mockResolvedValue([]);

      const result = await summaryReportService.generateReportDataset({
        periodType: 'DAILY',
        date: '2026-10-28',
        clientId: mockClientId,
        role: 'PLUMBER', // No plumbers in company
        user: mockUser as any,
      });

      expect(result).toBeDefined();
      expect(result.summary.totalEmployees).toBe(0);
      expect(result.summary.completedPatrols).toBe(0);
      expect(result.summary.totalPatrolDurationSeconds).toBe(0);
      expect(result.summary.totalPatrolDurationFormatted).toBe('0 sec');
      expect(result.employeeSummary).toHaveLength(0);
    });
  });

  describe('Task 3 & 4 — Patrol and Checkpoint Duration Analytics & Boundary Clipping', () => {
    it('3. should calculate Total Patrol Duration and Checkpoint Duration separately without combining them', async () => {
      const mockSession = {
        id: 'sess_1',
        siteId: mockSiteId,
        shiftId: mockShiftId,
        guardId: mockEmployeeId,
        status: 'COMPLETED',
        startedAt: new Date('2026-10-28T09:00:00.000Z'),
        endedAt: new Date('2026-10-28T10:00:00.000Z'), // 3600 seconds (1 hr)
        site: { name: 'Dubai Hub' },
        shift: { name: 'Day Shift' },
        guard: { id: mockEmployeeId, firstName: 'Ahmed', lastName: 'Khan', role: 'SECURITY', employeeNumber: 'EMP-001' },
        checkpoints: [
          {
            id: 'scan_1',
            checkpointId: 'chk_1',
            scanned: true,
            scannedAt: new Date('2026-10-28T09:08:00.000Z'),
            completedAt: new Date('2026-10-28T09:10:00.000Z'), // 120 seconds (2 min)
            gate: { name: 'Main Gate' },
          },
        ],
      };

      (prisma.patrolSession.findMany as jest.Mock).mockResolvedValue([mockSession]);

      const result = await summaryReportService.generateReportDataset({
        periodType: 'DAILY',
        date: '2026-10-28',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        user: mockUser as any,
      });

      expect(result.summary.totalPatrolDurationSeconds).toBe(3600);
      expect(result.summary.totalPatrolDurationFormatted).toBe('1 hr');
      expect(result.summary.totalCheckpointDurationSeconds).toBe(120);
      expect(result.summary.totalCheckpointDurationFormatted).toBe('2 min');
      expect(result.summary.completedPatrolsCount).toBe(1);
      expect(result.summary.completedCheckpointsCount).toBe(1);

      // Verify they are not combined
      expect(result.summary).not.toHaveProperty('totalWorkingDuration');
      expect((result.summary as any).totalWorkingDuration).toBeUndefined();
    });

    it('4. should clip overnight patrols crossing midnight so Day 1 and Day 2 do not double-count', () => {
      // Patrol starts 23:50 (Day 1) and ends 00:20 (Day 2) -> Total 30 min (1800 sec)
      const sessionStart = new Date('2026-10-28T23:50:00.000Z');
      const sessionEnd = new Date('2026-10-29T00:20:00.000Z');

      // Day 1: 2026-10-28 00:00:00 to 2026-10-28 23:59:59.999
      const day1Start = new Date('2026-10-28T00:00:00.000Z');
      const day1End = new Date('2026-10-28T23:59:59.999Z');
      const day1Duration = calculateOverlapDurationSeconds(sessionStart, sessionEnd, day1Start, day1End);

      // Day 2: 2026-10-29 00:00:00 to 2026-10-29 23:59:59.999
      const day2Start = new Date('2026-10-29T00:00:00.000Z');
      const day2End = new Date('2026-10-29T23:59:59.999Z');
      const day2Duration = calculateOverlapDurationSeconds(sessionStart, sessionEnd, day2Start, day2End);

      // Day 1 should have 600 seconds (10 min, 23:50 to 00:00)
      expect(day1Duration).toBe(600);
      // Day 2 should have 1200 seconds (20 min, 00:00 to 00:20)
      expect(day2Duration).toBe(1200);

      // Sum of non-overlapping adjacent slices equals total session duration (1800s)
      expect(day1Duration + day2Duration).toBe(1800);
    });

    it('5. should handle patrols with missing completion timestamps by tracking untracked counts', async () => {
      const incompleteSession = {
        id: 'sess_incomplete',
        siteId: mockSiteId,
        shiftId: mockShiftId,
        guardId: mockEmployeeId,
        status: 'INCOMPLETE',
        startedAt: new Date('2026-10-28T09:00:00.000Z'),
        endedAt: null, // Missing completion timestamp
        site: { name: 'Dubai Hub' },
        shift: { name: 'Day Shift' },
        guard: { id: mockEmployeeId, firstName: 'Ahmed', lastName: 'Khan', role: 'SECURITY', employeeNumber: 'EMP-001' },
        checkpoints: [],
      };

      (prisma.patrolSession.findMany as jest.Mock).mockResolvedValue([incompleteSession]);

      const result = await summaryReportService.generateReportDataset({
        periodType: 'DAILY',
        date: '2026-10-28',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        user: mockUser as any,
      });

      expect(result.summary.totalPatrolDurationSeconds).toBe(0);
      expect(result.summary.untrackedDurationPatrolsCount).toBe(1);
    });

    it('6. should correctly generate dailyBreakdown for selected employee over a weekly report', async () => {
      const mondaySession = {
        id: 'sess_mon',
        siteId: mockSiteId,
        shiftId: mockShiftId,
        guardId: mockEmployeeId,
        status: 'COMPLETED',
        startedAt: new Date('2026-10-26T08:00:00.000Z'),
        endedAt: new Date('2026-10-26T09:00:00.000Z'),
        site: { name: 'Dubai Hub' },
        shift: { name: 'Day Shift' },
        guard: { id: mockEmployeeId, firstName: 'Ahmed', lastName: 'Khan', role: 'SECURITY', employeeNumber: 'EMP-001' },
        checkpoints: [
          {
            id: 'scan_m1',
            checkpointId: 'chk_1',
            scanned: true,
            scannedAt: new Date('2026-10-26T08:10:00.000Z'),
            completedAt: new Date('2026-10-26T08:15:00.000Z'), // 300s
            gate: { name: 'Gate' },
          },
        ],
      };

      const tuesdaySession = {
        id: 'sess_tue',
        siteId: mockSiteId,
        shiftId: mockShiftId,
        guardId: mockEmployeeId,
        status: 'COMPLETED',
        startedAt: new Date('2026-10-27T08:00:00.000Z'),
        endedAt: new Date('2026-10-27T08:45:00.000Z'), // 2700s
        site: { name: 'Dubai Hub' },
        shift: { name: 'Day Shift' },
        guard: { id: mockEmployeeId, firstName: 'Ahmed', lastName: 'Khan', role: 'SECURITY', employeeNumber: 'EMP-001' },
        checkpoints: [],
      };

      (prisma.patrolSession.findMany as jest.Mock).mockResolvedValue([mondaySession, tuesdaySession]);

      const result = await summaryReportService.generateReportDataset({
        periodType: 'WEEKLY',
        date: '2026-10-26',
        clientId: mockClientId,
        employeeId: mockEmployeeId,
        user: mockUser as any,
      });

      expect(result.dailyBreakdown).toBeDefined();
      expect(result.dailyBreakdown!.length).toBeGreaterThanOrEqual(2);

      const monEntry = result.dailyBreakdown!.find((b) => b.date === '2026-10-26');
      expect(monEntry).toBeDefined();
      expect(monEntry!.patrolSessionsCount).toBe(1);
      expect(monEntry!.patrolDurationSeconds).toBe(3600);
      expect(monEntry!.checkpointsCount).toBe(1);
      expect(monEntry!.checkpointDurationSeconds).toBe(300);

      const tueEntry = result.dailyBreakdown!.find((b) => b.date === '2026-10-27');
      expect(tueEntry).toBeDefined();
      expect(tueEntry!.patrolSessionsCount).toBe(1);
      expect(tueEntry!.patrolDurationSeconds).toBe(2700);
    });
  });

  describe('Task 5 & 6 — PDF and Excel Duration Analytics Integration', () => {
    it('7. should include duration analytics metrics in Excel workbook', async () => {
      const mockReportData = {
        metadata: {
          periodType: 'MONTHLY' as const,
          periodLabel: 'October 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          clientName: 'Kaizen Properties',
          generatedAt: new Date().toISOString(),
          timezone: 'Asia/Dubai',
          employeeId: mockEmployeeId,
          employeeName: 'Ahmed Khan',
        },
        summary: {
          totalEmployees: 1,
          activeEmployees: 1,
          totalShifts: 1,
          assignedPatrols: 10,
          completedPatrols: 10,
          incompletePatrols: 0,
          additionalPatrols: 0,
          mandatoryScheduled: 5,
          mandatoryCompleted: 5,
          mandatoryMissed: 0,
          mandatoryCompliancePct: 100,
          totalCheckpoints: 50,
          checkpointsScanned: 50,
          checkpointsMissed: 0,
          requiredCheckpoints: 50,
          completedCheckpoints: 50,
          missedCheckpoints: 0,
          checkpointCompletionPct: 100,
          incidentsCount: 0,
          totalPatrolDurationSeconds: 67320, // 18 hr 42 min
          totalPatrolDurationFormatted: '18 hr 42 min',
          totalCheckpointDurationSeconds: 40560, // 11 hr 16 min
          totalCheckpointDurationFormatted: '11 hr 16 min',
          completedPatrolsCount: 24,
          completedCheckpointsCount: 186,
          avgPatrolDurationFormatted: '46 min',
          avgCheckpointDurationFormatted: '3 min 38 sec',
        },
        dailyBreakdown: [
          {
            date: '2026-10-01',
            shiftName: 'Day Shift',
            siteName: 'Dubai Hub',
            patrolSessionsCount: 2,
            patrolDurationSeconds: 7200,
            patrolDurationFormatted: '2 hr',
            checkpointsCount: 15,
            checkpointDurationSeconds: 1800,
            checkpointDurationFormatted: '30 min',
          },
        ],
        attendance: [],
        patrols: [
          {
            id: 'sess_1',
            date: '2026-10-01',
            guardName: 'Ahmed Khan',
            siteName: 'Dubai Hub',
            shiftName: 'Day Shift',
            status: 'COMPLETED',
            startedAt: '2026-10-01T08:00:00Z',
            endedAt: '2026-10-01T09:00:00Z',
            durationSeconds: 3600,
            durationFormatted: '1 hr',
            totalCheckpoints: 5,
            completedCheckpoints: 5,
            checkpointDurationSeconds: 600,
            checkpointDurationFormatted: '10 min',
          },
        ],
        mandatoryPatrols: [],
        checkpoints: [],
        incidents: [],
        siteSummary: [],
        employeeSummary: [
          {
            employeeId: mockEmployeeId,
            employeeName: 'Ahmed Khan',
            employeeRole: 'Security Guard',
            siteName: 'Dubai Hub',
            completedPatrols: 24,
            mandatoryCompleted: 5,
            mandatoryScheduled: 5,
            mandatoryCompliancePct: 100,
            checkpointsScanned: 186,
            patrolDurationSeconds: 67320,
            patrolDurationFormatted: '18 hr 42 min',
            checkpointDurationSeconds: 40560,
            checkpointDurationFormatted: '11 hr 16 min',
          },
        ],
      };

      const buffer = await excelGeneratorService.generateExcel(mockReportData as any);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it('8. should format human-readable duration strings with precise units', () => {
      expect(formatDurationHuman(0)).toBe('0 sec');
      expect(formatDurationHuman(45)).toBe('45 sec');
      expect(formatDurationHuman(60)).toBe('1 min');
      expect(formatDurationHuman(155)).toBe('2 min 35 sec');
      expect(formatDurationHuman(3600)).toBe('1 hr');
      expect(formatDurationHuman(67320)).toBe('18 hr 42 min');
    });
  });

  describe('Security & Multi-Tenant Isolation', () => {
    it('9. should reject unauthorized access if employee belongs to another client', async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        id: 'emp_foreign',
        clientId: 'client_competitor',
        firstName: 'Unauthorized',
      });

      await expect(
        summaryReportService.generateReportDataset({
          periodType: 'DAILY',
          date: '2026-10-28',
          clientId: mockClientId,
          employeeId: 'emp_foreign',
          user: mockUser as any,
        }),
      ).rejects.toThrow('Unauthorized employee report access requested.');
    });

    it('10. should reject unauthorized access if shift belongs to another client', async () => {
      (prisma.shift.findUnique as jest.Mock).mockResolvedValue({
        id: 'shift_foreign',
        clientId: 'client_competitor',
        name: 'Secret Shift',
      });

      await expect(
        summaryReportService.generateReportDataset({
          periodType: 'DAILY',
          date: '2026-10-28',
          clientId: mockClientId,
          shiftId: 'shift_foreign',
          user: mockUser as any,
        }),
      ).rejects.toThrow('Unauthorized shift filter requested.');
    });
  });
});
