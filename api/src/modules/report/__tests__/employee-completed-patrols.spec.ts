import { summaryReportService } from '../summary-report.service';
import { prisma } from '../../../database/prisma';

describe('Employee Completed Patrols Drill-Down Service', () => {
  const CLIENT_ID = 'cmsh1eerr0009hpaxnr8dbvz4'; // Atlabs Demo
  const HABEEB_ID = 'cmszyxge9010yhpxeh4sqjwz9'; // Habeeb Atlabs

  it('retrieves the exact 7 completed patrol sessions for Habeeb Atlabs in September 2026', async () => {
    // Generate periodic summary dataset first to get reference count
    const summaryData = await summaryReportService.generateReportDataset({
      clientId: CLIENT_ID,
      periodType: 'MONTHLY',
      month: '2026-09',
      date: '2026-09-01',
      user: { id: 'admin-test', role: 'SUPER_ADMIN' },
    });

    const habeebSummary = summaryData.employeeSummary.find((e) => e.employeeId === HABEEB_ID);
    expect(habeebSummary).toBeDefined();
    expect(habeebSummary?.completedPatrols).toBe(7);

    // Now query the employee drill-down endpoint
    const drillDownData = await summaryReportService.getEmployeeCompletedPatrols({
      clientId: CLIENT_ID,
      employeeId: HABEEB_ID,
      periodType: 'MONTHLY',
      month: '2026-09',
      date: '2026-09-01',
      user: { id: 'admin-test', role: 'SUPER_ADMIN' },
    });

    // 1. Numerical consistency check: Completed Patrol count must exactly match
    expect(drillDownData.summary.totalCompletedPatrols).toBe(habeebSummary?.completedPatrols);
    expect(drillDownData.summary.totalCompletedPatrols).toBe(7);
    expect(drillDownData.patrols.length).toBe(7);

    // 2. Employee and client identity checks
    expect(drillDownData.employee.id).toBe(HABEEB_ID);
    expect(drillDownData.employee.fullName).toBe('Habeeb Atlabs');
    expect(drillDownData.project.id).toBe(CLIENT_ID);
    expect(drillDownData.project.companyName).toBe('Atlabs Demo');

    // 3. Reporting period check
    expect(drillDownData.period.periodType).toBe('MONTHLY');
    expect(drillDownData.period.periodLabel).toContain('September 2026');

    // 4. Each patrol session check
    for (const patrol of drillDownData.patrols) {
      expect(patrol.status).toBe('COMPLETED');
      expect(patrol.patrolCode).toMatch(/^PATROL-SESSION-/);
      expect(patrol.dateFormatted).toBeDefined();
      expect(patrol.startTimeFormatted).toBeDefined();
      expect(patrol.endTimeFormatted).toBeDefined();
      expect(patrol.siteName).toBeDefined();
      expect(patrol.durationFormatted).toBeDefined();
    }

    // 5. Check distinct session IDs
    const sessionIds = new Set(drillDownData.patrols.map((p) => p.id));
    expect(sessionIds.size).toBe(7);
  });

  it('rejects requests with missing employeeId with BAD_REQUEST', async () => {
    await expect(
      summaryReportService.getEmployeeCompletedPatrols({
        clientId: CLIENT_ID,
        employeeId: '',
        periodType: 'MONTHLY',
        month: '2026-09',
        user: { id: 'admin-test', role: 'SUPER_ADMIN' },
      }),
    ).rejects.toThrow('Employee ID is required');
  });

  it('rejects unauthorized client access for CLIENT_ADMIN role', async () => {
    await expect(
      summaryReportService.getEmployeeCompletedPatrols({
        clientId: CLIENT_ID,
        employeeId: HABEEB_ID,
        periodType: 'MONTHLY',
        month: '2026-09',
        user: { id: 'unauth-client-admin', role: 'CLIENT_ADMIN', clientId: 'different-client-id' },
      }),
    ).rejects.toThrow('Unauthorized client access requested');
  });
});

