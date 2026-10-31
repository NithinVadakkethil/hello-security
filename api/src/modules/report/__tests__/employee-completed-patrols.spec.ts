import { summaryReportService } from '../summary-report.service';
import { reportService } from '../report.service';
import { prisma } from '../../../database/prisma';
import { calculateEmployeeAssignedCheckpoints } from '../../../common/utils/checkpoint-eligibility.util';

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

  describe('TASK 1 — Employee Total Assigned Checkpoints KPI', () => {
    it('returns totalAssignedCheckpoints when a specific employee is selected', async () => {
      const result = await summaryReportService.getEmployeeCompletedPatrols({
        clientId: CLIENT_ID,
        employeeId: HABEEB_ID,
        periodType: 'MONTHLY',
        month: '2026-09',
        user: { id: 'admin-test', role: 'SUPER_ADMIN' },
      });

      expect(result.summary.totalAssignedCheckpoints).toBeDefined();
      expect(typeof result.summary.totalAssignedCheckpoints).toBe('number');
      expect(result.summary.totalAssignedCheckpoints).toBeGreaterThanOrEqual(0);
    });

    it('omits totalAssignedCheckpoints when All Matching Employees is selected', async () => {
      const result = await summaryReportService.getEmployeeCompletedPatrols({
        clientId: CLIENT_ID,
        periodType: 'MONTHLY',
        month: '2026-09',
        user: { id: 'admin-test', role: 'SUPER_ADMIN' },
      });

      expect(result.summary.totalAssignedCheckpoints).toBeUndefined();
    });

    it('correctly calculates assigned checkpoints across routes and direct assignments with deduplication and deactivation handling', () => {
      const now = new Date('2026-10-31T12:00:00Z');

      const mockAssignments = [
        // Route Assignment 1: 3 gates (GATE-1, GATE-2, GATE-3)
        {
          id: 'asgn-1',
          isActive: true,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          patrolRoute: {
            id: 'route-1',
            isActive: true,
            routeGates: [
              { gateId: 'gate-1', gate: { id: 'gate-1', isActive: true } },
              { gateId: 'gate-2', gate: { id: 'gate-2', isActive: true } },
              { gateId: 'gate-3', gate: { id: 'gate-3', isActive: true } },
            ],
          },
        },
        // Route Assignment 2: 2 gates (GATE-2 is shared duplicate with Route 1, GATE-4 is new, GATE-5 is deactivated)
        {
          id: 'asgn-2',
          isActive: true,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          patrolRoute: {
            id: 'route-2',
            isActive: true,
            routeGates: [
              { gateId: 'gate-2', gate: { id: 'gate-2', isActive: true } }, // Duplicate! Must not be counted twice
              { gateId: 'gate-4', gate: { id: 'gate-4', isActive: true } },
              { gateId: 'gate-5', gate: { id: 'gate-5', isActive: false } }, // Deactivated gate! Must be excluded
            ],
          },
        },
        // Direct Checkpoints Assignment: 2 gates (GATE-1 is duplicate from Route 1, GATE-6 is new active)
        {
          id: 'asgn-3',
          isActive: true,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          assignmentGates: [
            { gateId: 'gate-1', gate: { id: 'gate-1', isActive: true } }, // Duplicate! Must not be counted twice
            { gateId: 'gate-6', gate: { id: 'gate-6', isActive: true } },
          ],
        },
        // Expired assignment: Should be ignored completely
        {
          id: 'asgn-expired',
          isActive: true,
          effectiveFrom: new Date('2025-01-01'),
          effectiveTo: new Date('2025-12-31'),
          patrolRoute: {
            id: 'route-old',
            isActive: true,
            routeGates: [
              { gateId: 'gate-99', gate: { id: 'gate-99', isActive: true } },
            ],
          },
        },
        // Inactive assignment: Should be ignored completely
        {
          id: 'asgn-inactive',
          isActive: false,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          patrolRoute: {
            id: 'route-inactive',
            isActive: true,
            routeGates: [
              { gateId: 'gate-100', gate: { id: 'gate-100', isActive: true } },
            ],
          },
        },
        // Inactive route on active assignment: Route gates should be ignored
        {
          id: 'asgn-inactive-route',
          isActive: true,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          patrolRoute: {
            id: 'route-disabled',
            isActive: false,
            routeGates: [
              { gateId: 'gate-200', gate: { id: 'gate-200', isActive: true } },
            ],
          },
        },
      ];

      // Eligible distinct gates:
      // gate-1, gate-2, gate-3, gate-4, gate-6 = exactly 5 distinct active gates
      const total = calculateEmployeeAssignedCheckpoints(mockAssignments, now);
      expect(total).toBe(5);
    });
  });

  describe('TASK 2 — Completed/Incomplete Patrol Sessions Table Filter', () => {
    it('preserves all summary KPI cards identically when filtering table by completionStatus', async () => {
      // 1. Fetch with ALL (default)
      const allResult = await summaryReportService.getEmployeeCompletedPatrols({
        clientId: CLIENT_ID,
        periodType: 'MONTHLY',
        month: '2026-09',
        completionStatus: 'ALL',
        user: { id: 'admin-test', role: 'SUPER_ADMIN' },
      });

      // 2. Fetch with COMPLETED
      const completedResult = await summaryReportService.getEmployeeCompletedPatrols({
        clientId: CLIENT_ID,
        periodType: 'MONTHLY',
        month: '2026-09',
        completionStatus: 'COMPLETED',
        user: { id: 'admin-test', role: 'SUPER_ADMIN' },
      });

      // 3. Fetch with INCOMPLETE
      const incompleteResult = await summaryReportService.getEmployeeCompletedPatrols({
        clientId: CLIENT_ID,
        periodType: 'MONTHLY',
        month: '2026-09',
        completionStatus: 'INCOMPLETE',
        user: { id: 'admin-test', role: 'SUPER_ADMIN' },
      });

      // CRITICAL INVARIANT: The 8 KPI summary cards represent the entire report scope
      // and MUST NOT change when table status filter is changed!
      expect(completedResult.summary.totalPatrolSessions).toBe(allResult.summary.totalPatrolSessions);
      expect(incompleteResult.summary.totalPatrolSessions).toBe(allResult.summary.totalPatrolSessions);

      expect(completedResult.summary.completedPatrolSessions).toBe(allResult.summary.completedPatrolSessions);
      expect(incompleteResult.summary.completedPatrolSessions).toBe(allResult.summary.completedPatrolSessions);

      expect(completedResult.summary.incompletePatrolSessions).toBe(allResult.summary.incompletePatrolSessions);
      expect(incompleteResult.summary.incompletePatrolSessions).toBe(allResult.summary.incompletePatrolSessions);

      expect(completedResult.summary.totalPatrolDurationSeconds).toBe(allResult.summary.totalPatrolDurationSeconds);
      expect(incompleteResult.summary.totalPatrolDurationSeconds).toBe(allResult.summary.totalPatrolDurationSeconds);

      expect(completedResult.summary.totalCheckpoints).toBe(allResult.summary.totalCheckpoints);
      expect(incompleteResult.summary.totalCheckpoints).toBe(allResult.summary.totalCheckpoints);

      expect(completedResult.summary.totalCheckpointsScanned).toBe(allResult.summary.totalCheckpointsScanned);
      expect(incompleteResult.summary.totalCheckpointsScanned).toBe(allResult.summary.totalCheckpointsScanned);

      expect(completedResult.summary.totalCheckpointsMissed).toBe(allResult.summary.totalCheckpointsMissed);
      expect(incompleteResult.summary.totalCheckpointsMissed).toBe(allResult.summary.totalCheckpointsMissed);

      expect(completedResult.summary.averageCompliancePct).toBe(allResult.summary.averageCompliancePct);
      expect(incompleteResult.summary.averageCompliancePct).toBe(allResult.summary.averageCompliancePct);

      // TABLE ROWS & PAGINATION: Reflect only the filtered status
      for (const p of completedResult.patrols) {
        expect(p.checkpointCompletionStatus).toBe('COMPLETED');
        expect(p.missedCheckpoints).toBe(0);
      }

      for (const p of incompleteResult.patrols) {
        expect(p.checkpointCompletionStatus).toBe('INCOMPLETE');
        expect(p.missedCheckpoints).toBeGreaterThan(0);
      }

      expect(completedResult.pagination.totalCount).toBe(allResult.summary.completedPatrolSessions);
      expect(incompleteResult.pagination.totalCount).toBe(allResult.summary.incompletePatrolSessions);
      expect(completedResult.pagination.totalCount + incompleteResult.pagination.totalCount).toBeLessThanOrEqual(
        allResult.summary.totalPatrolSessions ?? allResult.pagination.totalCount
      );
    });
  });
});

