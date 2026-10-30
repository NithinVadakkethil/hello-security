import { summaryReportService } from '../summary-report.service';
import { reportService } from '../report.service';
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

    // Checkpoint summary fields
    expect(drillDownData.summary.totalCheckpoints).toBeDefined();
    expect(drillDownData.summary.totalCheckpointsMissed).toBeDefined();
    expect(drillDownData.summary.totalCheckpoints).toBe(
      drillDownData.summary.totalCheckpointsScanned + drillDownData.summary.totalCheckpointsMissed
    );

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
      expect(patrol.totalCheckpoints).toBeDefined();
      expect(patrol.scannedCheckpoints).toBeDefined();
      expect(patrol.missedCheckpoints).toBeDefined();
      expect(patrol.totalCheckpoints).toBe(patrol.scannedCheckpoints + patrol.missedCheckpoints);
      expect(patrol.checkpointCompletionStatus).toBeDefined();

      if (patrol.missedCheckpoints > 0) {
        expect(patrol.checkpointCompletionStatus).toBe('INCOMPLETE');
      } else if (patrol.totalCheckpoints > 0) {
        expect(patrol.checkpointCompletionStatus).toBe('COMPLETED');
      }
    }

    // 5. Check distinct session IDs
    const sessionIds = new Set(drillDownData.patrols.map((p) => p.id));
    expect(sessionIds.size).toBe(7);
  });

  it('supports querying completed patrols for all matching employees when employeeId is omitted', async () => {
    const result = await summaryReportService.getEmployeeCompletedPatrols({
      clientId: CLIENT_ID,
      periodType: 'MONTHLY',
      month: '2026-09',
      user: { id: 'admin-test', role: 'SUPER_ADMIN' },
    });

    expect(result).toBeDefined();
    expect(result.employee).toBeNull();
    expect(result.summary.totalCompletedPatrols).toBeGreaterThan(0);
    expect(result.summary.totalCheckpoints).toBeGreaterThan(0);
    expect(result.summary.totalCheckpointsScanned).toBeGreaterThan(0);
    expect(result.summary.totalCheckpointsMissed).toBeGreaterThanOrEqual(0);
    expect(result.patrols.length).toBeGreaterThan(0);
    // Each patrol should have employee details mapped
    expect(result.patrols[0].employeeName).toBeDefined();
    expect(result.patrols[0].employeeRole).toBeDefined();
    expect(result.patrols[0].missedCheckpoints).toBeDefined();
  });

  it('retrieves missed checkpoints and checklist tasks for a patrol session', async () => {
    // Find a session with missed checkpoints
    const drillDownData = await summaryReportService.getEmployeeCompletedPatrols({
      clientId: CLIENT_ID,
      periodType: 'MONTHLY',
      month: '2026-09',
      user: { id: 'admin-test', role: 'SUPER_ADMIN' },
    });

    const sessionWithMissed = drillDownData.patrols.find((p) => (p.missedCheckpoints || 0) > 0);
    if (sessionWithMissed) {
      const missedData = await reportService.getPatrolMissedCheckpoints(sessionWithMissed.id, CLIENT_ID);
      expect(missedData).toBeDefined();
      expect(missedData.patrolId).toBe(sessionWithMissed.id);
      expect(missedData.patrolCode).toBe(sessionWithMissed.patrolCode);
      expect(missedData.missedCheckpoints).toBe(sessionWithMissed.missedCheckpoints);
      expect(missedData.missedGates.length).toBe(sessionWithMissed.missedCheckpoints);
      for (const gate of missedData.missedGates) {
        expect(gate.status).toBe('MISSED');
        expect(gate.sequence).toBeGreaterThan(0);
        expect(gate.gateCode).toBeDefined();
        for (const task of gate.tasks) {
          expect(task.status).toBe('NOT ANSWERED');
        }
      }
    }
  });

  it('supports querying completed patrols when employeeId="all" without throwing validation errors', async () => {
    const result = await summaryReportService.getEmployeeCompletedPatrols({
      clientId: CLIENT_ID,
      employeeId: 'all',
      periodType: 'MONTHLY',
      month: '2026-09',
      user: { id: 'admin-test', role: 'SUPER_ADMIN' },
    });

    expect(result).toBeDefined();
    expect(result.employee).toBeNull();
    expect(result.summary.totalCompletedPatrols).toBeGreaterThan(0);
    expect(result.summary.totalPatrolDurationSeconds).toBeGreaterThan(0);
    expect(result.summary.totalPatrolDurationFormatted).toBeDefined();
    expect(result.summary.totalCheckpointsScanned).toBeGreaterThan(0);
    expect(result.summary.totalCheckpointsRequired).toBeGreaterThan(0);
    expect(result.summary.averageCompliancePct).toBeGreaterThanOrEqual(0);
    expect(result.summary.averageCompliancePct).toBeLessThanOrEqual(100);
    expect(result.patrols.length).toBeGreaterThan(0);
  });

  it('supports sorting by compliance with stable secondary sort', async () => {
    const result = await summaryReportService.getEmployeeCompletedPatrols({
      clientId: CLIENT_ID,
      periodType: 'MONTHLY',
      month: '2026-09',
      sortBy: 'compliance',
      sortOrder: 'asc',
      user: { id: 'admin-test', role: 'SUPER_ADMIN' },
    });

    expect(result).toBeDefined();
    expect(result.patrols.length).toBeGreaterThan(1);
    for (let i = 0; i < result.patrols.length - 1; i++) {
      expect(result.patrols[i].compliancePct).toBeLessThanOrEqual(result.patrols[i + 1].compliancePct);
    }
  });

  it('strictly enforces mathematical invariants and fixes checkpoint scan overcounting for PATROL-SESSION-000017', async () => {
    const PENINSULA_5_CLIENT = 'cmtlcylq600axhpwpxc98pahk';
    const SYLVESTER_ID = 'cmtu58g0t059hhpt33gfyqnnc';

    const result = await summaryReportService.getEmployeeCompletedPatrols({
      clientId: PENINSULA_5_CLIENT,
      employeeId: SYLVESTER_ID,
      periodType: 'MONTHLY',
      month: '2026-09',
      date: '2026-09-01',
      user: { id: 'admin-test', role: 'SUPER_ADMIN' },
    });

    expect(result).toBeDefined();
    expect(result.summary.totalCompletedPatrols).toBeGreaterThan(0);

    // KPI card invariant: Total Checkpoints = Scanned + Missed
    expect(result.summary.totalCheckpoints).toBe(
      result.summary.totalCheckpointsScanned + result.summary.totalCheckpointsMissed
    );
    expect(result.summary.averageCompliancePct).toBeGreaterThanOrEqual(0);
    expect(result.summary.averageCompliancePct).toBeLessThanOrEqual(100);

    // Find PATROL-SESSION-000017
    const session17 = result.patrols.find((p) => p.patrolCode === 'PATROL-SESSION-000017');
    if (session17) {
      // Must NOT overcount 15 scans on 11 route gates
      expect(session17.totalCheckpoints).toBe(11);
      expect(session17.scannedCheckpoints).toBe(8);
      expect(session17.missedCheckpoints).toBe(3);
      expect(session17.compliancePct).toBe(73); // 8/11 = 72.7% -> 73%
      expect(session17.compliancePct).toBeLessThanOrEqual(100);
      expect(session17.checkpointCompletionStatus).toBe('INCOMPLETE');

      // Verify Missed Checkpoints Modal parity
      const missedData = await reportService.getPatrolMissedCheckpoints(session17.id, PENINSULA_5_CLIENT);
      expect(missedData.totalCheckpoints).toBe(11);
      expect(missedData.scannedCheckpoints).toBe(8);
      expect(missedData.missedCheckpoints).toBe(3);
      expect(missedData.missedGates.length).toBe(3);
    }

    // Mathematical invariants across all returned patrols
    for (const p of result.patrols) {
      expect(p.scannedCheckpoints).toBeLessThanOrEqual(p.totalCheckpoints);
      expect(p.missedCheckpoints).toBeLessThanOrEqual(p.totalCheckpoints);
      expect(p.scannedCheckpoints + p.missedCheckpoints).toBe(p.totalCheckpoints);
      expect(p.compliancePct).toBeGreaterThanOrEqual(0);
      expect(p.compliancePct).toBeLessThanOrEqual(100);

      if (p.missedCheckpoints > 0 && p.status === 'COMPLETED') {
        expect(p.checkpointCompletionStatus).toBe('INCOMPLETE');
      } else if (p.totalCheckpoints > 0 && p.missedCheckpoints === 0 && p.status === 'COMPLETED') {
        expect(p.checkpointCompletionStatus).toBe('COMPLETED');
      }
    }
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

