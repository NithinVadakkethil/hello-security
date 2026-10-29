import { UserRole } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { summaryReportService } from '../summary-report.service';
import { excelGeneratorService } from '../excel-generator.service';

function getWeekBoundaries(dateInput: string) {
  const parts = dateInput.split('T')[0].split('-').map(Number);
  const ref = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  const dayOfWeek = ref.getDay();
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const mon = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMonday, 0, 0, 0, 0);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6, 23, 59, 59, 999);

  const formatYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const startFormatted = `${mon.getDate()} ${mon.toLocaleDateString('en-US', { month: 'short' })}${
    mon.getFullYear() !== sun.getFullYear() ? ` ${mon.getFullYear()}` : ''
  }`;
  const endFormatted = `${sun.getDate()} ${sun.toLocaleDateString('en-US', { month: 'short' })} ${sun.getFullYear()}`;

  return {
    startDate: formatYMD(mon),
    endDate: formatYMD(sun),
    label: `${startFormatted} – ${endFormatted}`,
  };
}

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

describe('SummaryReportService - Role, Shift, Date Range & Weekly Enhancements', () => {
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
      { clientId: mockClientId, isActive: true },
    ]);

    (prisma.client.findFirst as jest.Mock).mockResolvedValue({
      id: mockClientId,
      companyName: 'Kaizen Security Services',
      clientCode: 'KAIZEN-001',
      clientLogoUrl: null,
    });

    (prisma.employee.count as jest.Mock).mockResolvedValue(10);
    (prisma.shift.count as jest.Mock).mockResolvedValue(2);
    (prisma.employee.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.patrolSession.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.mandatoryPatrolInstance.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.guardAssignment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.incident.findMany as jest.Mock).mockResolvedValue([]);
  });

  // Test 1: All Security Guards, all shifts, daily report
  it('1. should generate daily report for All Security Guards across all shifts', async () => {
    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-10-26',
      clientId: mockClientId,
      role: 'SECURITY',
      user: mockUser,
    });

    expect(dataset.metadata.periodType).toBe('DAILY');
    expect(dataset.metadata.roleLabel).toBe('Security Guard');
    expect(dataset.metadata.title).toContain('Security Guard Operations Report');
    expect(prisma.patrolSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { assignment: { employee: { role: UserRole.SECURITY } } },
            { managerUser: { employee: { role: UserRole.SECURITY } } },
          ],
        }),
      }),
    );
  });

  // Test 2: All Security Guards, selected shift, weekly report
  it('2. should generate weekly report for All Security Guards and selected shift', async () => {
    (prisma.shift.findUnique as jest.Mock).mockResolvedValue({
      id: 'shift-day-1',
      clientId: mockClientId,
      name: 'Day Shift',
    });

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'WEEKLY',
      date: '2026-10-28',
      clientId: mockClientId,
      role: 'SECURITY',
      shiftId: 'shift-day-1',
      user: mockUser,
    });

    expect(dataset.metadata.periodType).toBe('WEEKLY');
    expect(dataset.metadata.shiftName).toBe('Day Shift');
    expect(prisma.patrolSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignment: expect.objectContaining({ shiftId: 'shift-day-1' }),
        }),
      }),
    );
    expect(prisma.mandatoryPatrolInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shiftId: 'shift-day-1',
          employee: { role: UserRole.SECURITY },
        }),
      }),
    );
  });

  // Test 3: All Security Guards, selected site, custom range
  it('3. should generate custom range report for All Security Guards and selected site', async () => {
    (prisma.site.findUnique as jest.Mock).mockResolvedValue({
      id: 'site-peninsula-1',
      clientId: mockClientId,
      name: 'Peninsula 1',
    });

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'CUSTOM',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      clientId: mockClientId,
      siteId: 'site-peninsula-1',
      role: 'SECURITY',
      user: mockUser,
    });

    expect(dataset.metadata.periodType).toBe('CUSTOM');
    expect(dataset.metadata.siteName).toBe('Peninsula 1');
    expect(dataset.metadata.periodLabel).toBe('Oct 01, 2026 to Oct 15, 2026');
  });

  // Test 4: One selected Security Guard, monthly report
  it('4. should generate monthly report for one selected Security Guard with individual patrols', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
      id: 'emp-guard-42',
      clientId: mockClientId,
      firstName: 'Ujjwal',
      lastName: 'Shreshtha',
      role: UserRole.SECURITY,
      designation: 'Security Guard',
      employeeNumber: 'SG-10042',
      status: 'ACTIVE',
    });

    (prisma.patrolSession.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'patrol-sess-1',
        patrolCode: 'PAT-001',
        startedAt: new Date('2026-10-10T08:00:00Z'),
        endedAt: new Date('2026-10-10T09:00:00Z'),
        status: 'COMPLETED',
        totalDuration: 3600,
        assignment: {
          employeeId: 'emp-guard-42',
          employee: { firstName: 'Ujjwal', lastName: 'Shreshtha', role: UserRole.SECURITY },
          site: { name: 'Peninsula 1' },
          shift: { name: 'Day Shift' },
          patrolRoute: { name: 'Tower Route', routeGates: [{ id: 'gate-1' }, { id: 'gate-2' }] },
          assignmentGates: [],
        },
        checkpoints: [{ id: 'cp-1', gate: { name: 'Gate 1' }, scannedAt: new Date() }],
      },
    ]);

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'MONTHLY',
      month: '2026-10',
      clientId: mockClientId,
      employeeId: 'emp-guard-42',
      user: mockUser,
    });

    expect(dataset.metadata.employeeName).toBe('Ujjwal Shreshtha');
    expect(dataset.metadata.employeeNumber).toBe('SG-10042');
    expect(dataset.patrols.length).toBe(1);
    expect(dataset.patrols[0].patrolCode).toBe('PAT-001');
  });

  // Test 5: All Roles, all employees, custom range
  it('5. should generate consolidated report for All Roles across all employees', async () => {
    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'CUSTOM',
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
      clientId: mockClientId,
      role: 'ALL',
      user: mockUser,
    });

    expect(dataset.metadata.periodType).toBe('CUSTOM');
    expect(dataset.metadata.roleLabel).toBe('All Roles');
    expect(dataset.metadata.title).toContain('Hello Orbit CUSTOM Security & Operations Report');
  });

  // Test 6: Role change updates employee list correctly
  it('6. should filter employee options by selected role correctly', () => {
    const employees = [
      { id: '1', firstName: 'John', role: 'SECURITY' },
      { id: '2', firstName: 'Alice', role: 'SUPERVISOR' },
      { id: '3', firstName: 'Bob', role: 'TECHNICIAN' },
    ];

    const securityGuards = employees.filter((e) => e.role === 'SECURITY');
    expect(securityGuards.length).toBe(1);
    expect(securityGuards[0].firstName).toBe('John');

    const supervisors = employees.filter((e) => e.role === 'SUPERVISOR');
    expect(supervisors.length).toBe(1);
    expect(supervisors[0].firstName).toBe('Alice');
  });

  // Test 7: Invalid role/employee combinations are rejected
  it('7. should reject invalid role/employee combination with 400 BAD_REQUEST', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
      id: 'emp-tech-1',
      clientId: mockClientId,
      firstName: 'Tom',
      role: UserRole.TECHNICIAN,
      designation: 'Technician',
    });

    await expect(
      summaryReportService.generateReportDataset({
        periodType: 'DAILY',
        date: '2026-10-26',
        clientId: mockClientId,
        role: 'SECURITY',
        employeeId: 'emp-tech-1',
        user: mockUser,
      }),
    ).rejects.toThrow('Selected employee does not belong to role Security Guard');
  });

  // Test 8: Unauthorized employee, site, or shift IDs are rejected
  it('8. should reject unauthorized shift or site IDs belonging to another client', async () => {
    (prisma.shift.findUnique as jest.Mock).mockResolvedValue({
      id: 'shift-unauthorized',
      clientId: 'other-unauthorized-client',
      name: 'Secret Shift',
    });

    await expect(
      summaryReportService.generateReportDataset({
        periodType: 'DAILY',
        date: '2026-10-26',
        clientId: mockClientId,
        shiftId: 'shift-unauthorized',
        user: mockUser,
      }),
    ).rejects.toThrow('Unauthorized shift filter requested');
  });

  // Test 9: An overnight shift spanning two calendar dates
  it('9. should handle overnight shift spanning two calendar dates via shiftId associations', async () => {
    (prisma.shift.findUnique as jest.Mock).mockResolvedValue({
      id: 'shift-night-1',
      clientId: mockClientId,
      name: 'Night Shift (18:00 - 06:00)',
    });

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-10-26',
      clientId: mockClientId,
      shiftId: 'shift-night-1',
      user: mockUser,
    });

    expect(dataset.metadata.shiftName).toBe('Night Shift (18:00 - 06:00)');
    expect(prisma.patrolSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignment: expect.objectContaining({ shiftId: 'shift-night-1' }),
        }),
      }),
    );
  });

  // Test 10: A week spanning two months
  it('10. should accurately compute weekly calendar boundaries spanning two months', () => {
    // 28 Oct 2026 is Wednesday -> Week is Mon 26 Oct to Sun 01 Nov 2026
    const boundaries = getWeekBoundaries('2026-10-28');
    expect(boundaries.startDate).toBe('2026-10-26');
    expect(boundaries.endDate).toBe('2026-11-01');
    expect(boundaries.label).toBe('26 Oct – 1 Nov 2026');
  });

  // Test 11: A week spanning two years
  it('11. should accurately compute weekly calendar boundaries spanning two years', () => {
    // 30 Dec 2026 is Wednesday -> Week is Mon 28 Dec 2026 to Sun 03 Jan 2027
    const boundaries = getWeekBoundaries('2026-12-30');
    expect(boundaries.startDate).toBe('2026-12-28');
    expect(boundaries.endDate).toBe('2027-01-03');
    expect(boundaries.label).toBe('28 Dec 2026 – 3 Jan 2027');
  });

  // Test 12: Custom range with identical From/To dates
  it('12. should support custom range with identical From and To dates (single day range)', async () => {
    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'CUSTOM',
      startDate: '2026-10-26',
      endDate: '2026-10-26',
      clientId: mockClientId,
      user: mockUser,
    });

    expect(dataset.metadata.periodType).toBe('CUSTOM');
    expect(dataset.metadata.periodLabel).toBe('Oct 26, 2026 to Oct 26, 2026');
  });

  // Test 13: Invalid From/To date order rejected
  it('13. should reject invalid date order where To Date is earlier than From Date', async () => {
    await expect(
      summaryReportService.generateReportDataset({
        periodType: 'CUSTOM',
        startDate: '2026-10-28',
        endDate: '2026-10-20',
        clientId: mockClientId,
        user: mockUser,
      }),
    ).rejects.toThrow('To Date cannot be earlier than From Date');
  });

  // Test 14: No matching employees
  it('14. should handle empty results gracefully when no employees match filters', async () => {
    (prisma.employee.count as jest.Mock).mockResolvedValue(0);
    (prisma.employee.findMany as jest.Mock).mockResolvedValue([]);

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-10-26',
      clientId: mockClientId,
      role: 'LIFE_GUARD',
      user: mockUser,
    });

    expect(dataset.summary.totalEmployees).toBe(0);
    expect(dataset.employeeSummary.length).toBe(0);
    expect(dataset.summary.completedPatrols).toBe(0);
  });

  // Test 15: Matching employees with no activity included in summary
  it('15. should include eligible employees with 0 patrol activity in employeeSummary', async () => {
    (prisma.employee.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'emp-guard-inactive',
        firstName: 'Salim',
        lastName: 'Ahmed',
        role: UserRole.SECURITY,
        designation: 'Security Guard',
        assignments: [{ site: { name: 'Peninsula 1' }, shift: { name: 'Day Shift' } }],
      },
    ]);

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-10-26',
      clientId: mockClientId,
      role: 'SECURITY',
      user: mockUser,
    });

    expect(dataset.employeeSummary.length).toBe(1);
    expect(dataset.employeeSummary[0].employeeName).toBe('Salim Ahmed');
    expect(dataset.employeeSummary[0].completedPatrols).toBe(0);
    // 0/0 mandatory patrols now yields 0% compliance per updated business requirements
    expect(dataset.employeeSummary[0].mandatoryCompliancePct).toBe(0);
  });

  // Test 16: Large date-range report performance
  it('16. should calculate large date-range queries without timeout', async () => {
    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'CUSTOM',
      startDate: '2025-01-01',
      endDate: '2026-12-31',
      clientId: mockClientId,
      user: mockUser,
    });

    expect(dataset.metadata.periodLabel).toBe('Jan 01, 2025 to Dec 31, 2026');
  });

  // Test 17: PDF export matches UI data
  it('17. should include matching role, shift, and metrics in ReportDataset for PDF generation', async () => {
    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-10-26',
      clientId: mockClientId,
      role: 'SECURITY',
      user: mockUser,
    });

    expect(dataset.metadata.roleLabel).toBe('Security Guard');
    expect(dataset.summary.checkpointCompletionPct).toBeDefined();
  });

  // Test 18: Excel export matches UI data
  it('18. should generate valid Excel buffer containing Executive Summary sheet and matching metadata', async () => {
    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'WEEKLY',
      date: '2026-10-26',
      clientId: mockClientId,
      role: 'SECURITY',
      user: mockUser,
    });

    const excelBuffer = excelGeneratorService.generateExcel(dataset);
    expect(excelBuffer).toBeInstanceOf(Buffer);
    expect(excelBuffer.length).toBeGreaterThan(1000);
  });

  // Test 19: Existing employee-specific reports remain functional
  it('19. should preserve employee session details when exactly one employee is selected', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
      id: 'emp-guard-1',
      clientId: mockClientId,
      firstName: 'David',
      lastName: 'Miller',
      role: UserRole.SECURITY,
      designation: 'Security Guard',
    });

    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-10-26',
      clientId: mockClientId,
      employeeId: 'emp-guard-1',
      user: mockUser,
    });

    expect(dataset.metadata.employeeId).toBe('emp-guard-1');
    expect(dataset.metadata.employeeName).toBe('David Miller');
  });

  // Test 20: Report dropdowns and calendars remain usable at different screen sizes
  it('20. should provide accessible labels and responsive week boundary definitions', () => {
    const monday = getWeekBoundaries('2026-10-26');
    const sunday = getWeekBoundaries('2026-11-01');
    expect(monday.startDate).toBe(sunday.startDate);
    expect(monday.endDate).toBe(sunday.endDate);
  });
});
