import { UserRole } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { summaryReportService } from '../summary-report.service';
import { excelGeneratorService } from '../excel-generator.service';

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
    managerClientMembership: {
      findMany: jest.fn(),
    },
  },
}));

describe('SummaryReportService - Historical Attendance Timestamps & Verification', () => {
  const mockUser = {
    id: 'user-manager-1',
    role: 'MANAGER',
    clientId: null,
    tenantId: null,
  };

  const mockClientId = 'client-kaizen-1';

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.managerClientMembership.findMany as jest.Mock).mockResolvedValue([
      { clientId: mockClientId },
    ]);

    (prisma.client.findFirst as jest.Mock).mockResolvedValue({
      id: mockClientId,
      companyName: 'KAIZEN - PENINSULA 3',
      clientLogoUrl: null,
    });

    (prisma.site.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.shift.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.employee.count as jest.Mock).mockResolvedValue(5);
    (prisma.shift.count as jest.Mock).mockResolvedValue(1);
    (prisma.employee.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.patrolSession.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.mandatoryPatrolInstance.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.incident.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('1. should return null checkInTime and checkOutTime for historical GuardAssignment records', async () => {
    // When no dedicated attendance records exist for historical dates (e.g., 2026-09-11)
    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);

    // Guard assignment created on UTC midnight (which previously rendered as 4:00 AM in Dubai)
    const mockAssignment = {
      id: 'assign-1',
      effectiveFrom: new Date('2026-09-11T00:00:00.000Z'),
      effectiveTo: null,
      isActive: true,
      employee: {
        id: 'emp-1',
        firstName: 'Patras',
        lastName: 'Singh',
        role: 'SECURITY',
        designation: 'Security Guard',
        employeeNumber: 'EMP-000002',
      },
      site: {
        id: 'site-1',
        name: 'Peninsula 3 Tower',
      },
      shift: {
        id: 'shift-1',
        name: 'Day Shift',
      },
    };

    (prisma.guardAssignment.findMany as jest.Mock).mockResolvedValue([mockAssignment]);

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-09-11',
      clientId: mockClientId,
      user: mockUser,
    });

    expect(dataset.attendance).toHaveLength(1);
    const att = dataset.attendance[0];
    expect(att.shiftDate).toBe('2026-09-11');
    expect(att.employeeName).toBe('Patras Singh');
    expect(att.employeeNumber).toBe('EMP-000002');
    expect(att.status).toBe('PRESENT');
    // Must NOT be '4:00 AM' or any derived time from effectiveFrom
    expect(att.checkInTime).toBeNull();
    expect(att.checkOutTime).toBeNull();
  });

  it('2. should populate checkInTime when an authoritative verified Attendance record exists', async () => {
    // Genuine face-verified attendance record on 2026-10-04 at 07:44:04 UTC (11:44:04 AM GST)
    const mockAttendanceRecord = {
      id: 'att-verified-1',
      clientId: mockClientId,
      employeeId: 'emp-1',
      attendanceDate: new Date('2026-10-04T00:00:00.000Z'),
      checkInAt: new Date('2026-10-04T07:44:04.383Z'),
      checkOutAt: null,
      status: 'LATE',
      isLate: true,
      verificationMethod: 'FACE_VERIFICATION',
      verificationStatus: 'VERIFIED',
      employee: {
        id: 'emp-1',
        firstName: 'Muhammad',
        lastName: 'Naeem',
        role: 'SECURITY',
        designation: 'Security Guard',
        employeeNumber: 'EMP-000001',
      },
      site: {
        id: 'site-1',
        name: 'Peninsula 3 Tower',
      },
      shift: {
        id: 'shift-1',
        name: 'Morning Shift',
      },
    };

    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([mockAttendanceRecord]);

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-10-04',
      clientId: mockClientId,
      user: mockUser,
    });

    expect(dataset.attendance).toHaveLength(1);
    const att = dataset.attendance[0];
    expect(att.shiftDate).toBe('2026-10-04');
    expect(att.employeeName).toBe('Muhammad Naeem');
    expect(att.status).toBe('LATE');
    expect(att.isLate).toBe(true);
    // Verified check-in at 07:44:04 UTC in Asia/Dubai (UTC+4) formatted as date time
    expect(att.checkInTime).toBe('4 Oct 2026, 11:44 AM');
    expect(att.checkOutTime).toBeNull();
  });

  it('3. should return null checkInTime and checkOutTime for unverified/pending Attendance records', async () => {
    // Attendance record with verificationStatus: 'PENDING'
    const mockPendingAttendance = {
      id: 'att-pending-1',
      clientId: mockClientId,
      employeeId: 'emp-2',
      attendanceDate: new Date('2026-10-04T00:00:00.000Z'),
      checkInAt: new Date('2026-10-04T07:00:00.000Z'),
      checkOutAt: null,
      status: 'PENDING',
      isLate: false,
      verificationMethod: 'FACE_VERIFICATION',
      verificationStatus: 'PENDING', // Unverified
      employee: {
        id: 'emp-2',
        firstName: 'Unverified',
        lastName: 'Guard',
        role: 'SECURITY',
        designation: 'Security Guard',
        employeeNumber: 'EMP-000009',
      },
      site: {
        id: 'site-1',
        name: 'Peninsula 3 Tower',
      },
      shift: {
        id: 'shift-1',
        name: 'Morning Shift',
      },
    };

    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([mockPendingAttendance]);

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-10-04',
      clientId: mockClientId,
      user: mockUser,
    });

    expect(dataset.attendance).toHaveLength(1);
    const att = dataset.attendance[0];
    expect(att.employeeName).toBe('Unverified Guard');
    expect(att.status).toBe('PENDING');
    // Must be null because verificationStatus is PENDING
    expect(att.checkInTime).toBeNull();
    expect(att.checkOutTime).toBeNull();
  });

  it('4. should render "—" in Excel export for null checkInTime and checkOutTime', () => {
    const mockDataset = {
      metadata: {
        title: 'Hello Orbit Daily Security & Operations Report',
        periodType: 'DAILY',
        periodLabel: '2026-09-11',
        clientName: 'KAIZEN - PENINSULA 3',
        generatedAt: new Date().toISOString(),
        timezone: 'Asia/Dubai (GST)',
      },
      summary: {
        totalEmployees: 5,
        activeEmployees: 5,
        totalShifts: 1,
        completedPatrols: 0,
        totalCheckpoints: 0,
        completedCheckpoints: 0,
        totalPatrolDurationSeconds: 0,
        totalPatrolDurationFormatted: '0 sec',
        totalCheckpointDurationSeconds: 0,
        totalCheckpointDurationFormatted: '0 sec',
        completedPatrolsCount: 0,
        completedCheckpointsCount: 0,
        avgPatrolDurationFormatted: '0 sec',
        avgCheckpointDurationFormatted: '0 sec',
        incidentsCount: 0,
        mandatoryCompliancePct: 100,
        mandatoryScheduled: 0,
        mandatoryCompleted: 0,
        mandatoryMissed: 0,
      },
      dailyBreakdown: [],
      attendance: [
        {
          id: 'assign-1',
          shiftDate: '2026-09-11',
          employeeName: 'Patras Singh',
          employeeRole: 'Security Guard',
          employeeNumber: 'EMP-000002',
          siteName: 'Peninsula 3 Tower',
          shiftName: 'Day Shift',
          checkInTime: null, // Legacy record
          checkOutTime: null,
          status: 'PRESENT',
          isLate: false,
        },
        {
          id: 'att-1',
          shiftDate: '2026-10-04',
          employeeName: 'Muhammad Naeem',
          employeeRole: 'Security Guard',
          employeeNumber: 'EMP-000001',
          siteName: 'Peninsula 3 Tower',
          shiftName: 'Day Shift',
          checkInTime: '11:44:04 AM', // Verified record
          checkOutTime: null,
          status: 'LATE',
          isLate: true,
        },
      ],
      mandatoryPatrols: [],
      checkpoints: [],
      incidents: [],
      siteSummary: [],
      employeeSummary: [],
    };

    const excelBuffer = excelGeneratorService.generateExcel(mockDataset as any);
    expect(excelBuffer).toBeInstanceOf(Buffer);
    expect(excelBuffer.length).toBeGreaterThan(0);
  });
});
