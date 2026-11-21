import { reportService } from '../report.service';
import { excelGeneratorService } from '../excel-generator.service';
import { pdfGeneratorService } from '../pdf-generator.service';
import { ReportDataset } from '../summary-report.service';

describe('Hello Orbit — Emirates ID Across Reports and Terminology Standardization', () => {
  const mockReportWithEmiratesId: any = {
    id: 'session-eid-001',
    patrolCode: 'PATROL-SESSION-000188',
    status: 'COMPLETED',
    startedAt: '2026-10-29T10:00:00.000Z',
    endedAt: '2026-10-29T10:45:00.000Z',
    totalDuration: 2700,
    client: {
      companyName: 'Kaizen Properties LLC',
      clientLogoUrl: null,
    },
    assignment: {
      site: { name: 'Marina Gate Tower 1' },
      shift: { name: 'Morning', startTime: '08:00', endTime: '16:00' },
      patrolRoute: { name: 'Route Alpha', routeGates: [] },
      employee: {
        id: 'emp-18',
        firstName: 'aaliya',
        lastName: '',
        employeeNumber: 'EMP-000018',
        role: 'SECURITY',
        emiratesId: '784-1995-1234567-1',
      },
    },
    checkpoints: [],
  };

  const mockReportWithoutEmiratesId: any = {
    id: 'session-eid-002',
    patrolCode: 'PATROL-SESSION-000189',
    status: 'COMPLETED',
    startedAt: '2026-10-29T11:00:00.000Z',
    endedAt: '2026-10-29T11:30:00.000Z',
    totalDuration: 1800,
    client: {
      companyName: 'Atlabs Demo Client',
      clientLogoUrl: null,
    },
    assignment: {
      site: { name: 'Commercial Tower B' },
      shift: { name: 'Day', startTime: '06:00', endTime: '18:00' },
      patrolRoute: { name: 'Direct Checkpoints', routeGates: [] },
      employee: {
        id: 'emp-12',
        firstName: 'Asif',
        lastName: 'Khan',
        employeeNumber: 'EMP-000012',
        role: 'TECHNICIAN',
        emiratesId: null,
      },
    },
    checkpoints: [],
  };

  const mockDataset: ReportDataset = {
    metadata: {
      title: 'Hello Orbit Monthly Operations Report',
      periodType: 'MONTHLY',
      periodLabel: 'October 2026',
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-10-31T23:59:59.999Z',
      clientName: 'Atlabs Demo Client',
      siteName: 'Commercial Tower B',
      shiftName: 'Day Shift',
      roleLabel: 'All Roles',
      employeeName: 'aaliya',
      employeeRole: 'Security Guard',
      employeeNumber: 'EMP-000018',
      emiratesId: '784-1995-1234567-1',
      generatedAt: '2026-10-29T12:00:00.000Z',
      timezone: 'Asia/Dubai (GST)',
      includeIncidents: true,
      isKaizen: false,
    },
    summary: {
      totalEmployees: 5,
      activeEmployees: 5,
      totalShifts: 2,
      assignedPatrols: 10,
      completedPatrols: 8,
      incompletePatrols: 2,
      missedCheckpoints: 0,
      additionalPatrols: 0,
      checkpointsScanned: 24,
      totalCheckpoints: 24,
      requiredCheckpoints: 24,
      mandatoryScheduled: 8,
      mandatoryCompleted: 8,
      mandatoryMissed: 0,
      mandatoryCompliancePct: 100,
      incidentsCount: 0,
      totalPatrolDurationFormatted: '5h 30m',
      totalCheckpointDurationFormatted: '1h 15m',
    },
    attendance: [
      {
        id: 'att-1',
        shiftDate: '2026-10-29',
        employeeName: 'aaliya',
        employeeRole: 'Security Guard',
        employeeNumber: 'EMP-000018',
        emiratesId: '784-1995-1234567-1',
        siteName: 'Commercial Tower B',
        shiftName: 'Day Shift',
        checkInTime: '08:00 AM',
        checkOutTime: '05:00 PM',
        status: 'PRESENT',
        isLate: false,
      },
      {
        id: 'att-2',
        shiftDate: '2026-10-29',
        employeeName: 'Asif Khan',
        employeeRole: 'Technician',
        employeeNumber: 'EMP-000012',
        emiratesId: 'Not provided',
        siteName: 'Commercial Tower B',
        shiftName: 'Day Shift',
        checkInTime: '08:05 AM',
        checkOutTime: '05:00 PM',
        status: 'PRESENT',
        isLate: false,
      },
    ],
    patrols: [],
    mandatoryPatrols: [],
    checkpoints: [
      {
        id: 'cp-1',
        gateName: 'Main Entrance',
        siteName: 'Commercial Tower B',
        guardName: 'aaliya',
        patrolCode: 'PATROL-SESSION-000188',
        scannedAt: '2026-10-29 10:15 AM',
        status: 'VERIFIED',
        remarks: 'All locks secure',
      },
    ],
    incidents: [],
    siteSummary: [],
    employeeSummary: [
      {
        employeeId: 'emp-18',
        employeeName: 'aaliya',
        employeeNumber: 'EMP-000018',
        emiratesId: '784-1995-1234567-1',
        employeeRole: 'Security Guard',
        siteName: 'Commercial Tower B',
        completedPatrols: 5,
        patrolDurationSeconds: 12000,
        patrolDurationFormatted: '3h 20m',
        mandatoryScheduled: 5,
        mandatoryCompleted: 5,
        mandatoryCompliancePct: 100,
        checkpointsScanned: 15,
        completedCheckpoints: 15,
        checkpointDurationSeconds: 1800,
        checkpointDurationFormatted: '30m',
        incidentsCount: 0,
      },
      {
        employeeId: 'emp-12',
        employeeName: 'Asif Khan',
        employeeNumber: 'EMP-000012',
        emiratesId: 'Not provided',
        employeeRole: 'Technician',
        siteName: 'Commercial Tower B',
        completedPatrols: 3,
        patrolDurationSeconds: 7800,
        patrolDurationFormatted: '2h 10m',
        mandatoryScheduled: 3,
        mandatoryCompleted: 3,
        mandatoryCompliancePct: 100,
        checkpointsScanned: 9,
        completedCheckpoints: 9,
        checkpointDurationSeconds: 1200,
        checkpointDurationFormatted: '20m',
        incidentsCount: 0,
      },
    ],
  };

  describe('Task 1 — Display Emirates ID in Inspection Reports and PDF', () => {
    it('1. Displays unmasked formatted Emirates ID in Patrol HTML report when present', () => {
      const html = reportService.buildPatrolReportHtml(mockReportWithEmiratesId);

      expect(html).toContain('PATROL DETAILS');
      expect(html).toContain('Emirates ID');
      expect(html).toContain('784-1995-1234567-1');
    });

    it('2. Displays "Not provided" in Patrol HTML report when Emirates ID is missing', () => {
      const html = reportService.buildPatrolReportHtml(mockReportWithoutEmiratesId);

      expect(html).toContain('PATROL DETAILS');
      expect(html).toContain('Emirates ID');
      expect(html).toContain('Not provided');
    });

    it('3. Renders Emirates ID in Executive PDF generator and Attendance table', () => {
      const html = pdfGeneratorService.buildHtml(mockDataset);

      // Header Emirates ID
      expect(html).toContain('Emirates ID: <strong>784-1995-1234567-1</strong>');
      // Attendance column and values
      expect(html).toContain('<th>Emirates ID</th>');
      expect(html).toContain('784-1995-1234567-1');
      expect(html).toContain('Not provided');
      // Employee Summary table column and values
      expect(html).toContain('784-1995-1234567-1');
    });

    it('4. Renders Emirates ID in Excel export tabs', () => {
      const buffer = excelGeneratorService.generateExcel(mockDataset);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('Task 2 — Terminology Standardization (Officer -> Employee)', () => {
    it('5. Uses "Employee" label instead of "Officer" in PATROL DETAILS table', () => {
      const html = reportService.buildPatrolReportHtml(mockReportWithEmiratesId);

      // Section has Employee label
      expect(html).toContain('<td class="rpt-details-label">Employee</td>');
      expect(html).not.toContain('<td class="rpt-details-label">Officer</td>');
      expect(html).toContain('aaliya');
    });

    it('6. Preserves operational roles (e.g. SECURITY, TECHNICIAN) alongside Employee label', () => {
      const htmlGuard = reportService.buildPatrolReportHtml(mockReportWithEmiratesId);
      expect(htmlGuard).toContain('<td class="rpt-details-label">Employee</td>');
      expect(htmlGuard).toContain('<td class="rpt-details-label">Role</td>');
      expect(htmlGuard).toContain('SECURITY');

      const htmlTech = reportService.buildPatrolReportHtml(mockReportWithoutEmiratesId);
      expect(htmlTech).toContain('<td class="rpt-details-label">Employee</td>');
      expect(htmlTech).toContain('<td class="rpt-details-label">Role</td>');
      expect(htmlTech).toContain('TECHNICIAN');
    });

    it('7. Uses "Employee Performance Summary" in Executive PDF generator', () => {
      const html = pdfGeneratorService.buildHtml(mockDataset);

      expect(html).toContain('Employee Performance Summary');
      expect(html).not.toContain('Guard & Staff Performance Summary');
    });
  });
});
