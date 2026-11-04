import { calculateCompliancePercentage } from '../compliance.util';
import {
  buildPatrolCompletedEmailHtml,
  buildConsolidatedRouteCycleEmailHtml,
} from '../../email/templates/patrol-completed.template';
import { calculateCheckpointCompliance } from '../checkpoint-eligibility.util';

describe('Compliance Calculation & Email Template Regression Suite', () => {
  describe('Task 1 — Change Security Officer label to Employee in Email Templates', () => {
    it('1. Technician patrol completion email displays Employee label with Role: TECHNICIAN', () => {
      const html = buildConsolidatedRouteCycleEmailHtml({
        officerName: 'Asif Khan',
        employeeId: 'EMP-000012',
        officerRole: 'TECHNICIAN',
        siteName: 'Atlabs Tower 1',
        shiftName: 'Day Shift',
        cycleDate: '29 Oct 2026',
        assignedRoutesCount: 1,
        completedRoutesCount: 1,
        overallCompliancePercentage: 100,
        totalCheckpointsScanned: 5,
        totalCheckpointsCount: 5,
        totalObservationsCount: 0,
        routes: [],
      });

      // Must display Employee label
      expect(html).toContain('Employee</td>');
      expect(html).toContain('Asif Khan (EMP-000012)');
      // Must NOT contain static Security Officer label
      expect(html).not.toContain('Security Officer</td>');
      // Must preserve actual operational role
      expect(html).toContain('TECHNICIAN');
    });

    it('2. Security Guard email displays Employee label with Role: SECURITY', () => {
      const html = buildConsolidatedRouteCycleEmailHtml({
        officerName: 'Habeeb Guard',
        employeeId: 'EMP-000017',
        officerRole: 'SECURITY',
        siteName: 'Atlabs Tower 1',
        shiftName: 'Night Shift',
        cycleDate: '29 Oct 2026',
        assignedRoutesCount: 2,
        completedRoutesCount: 2,
        overallCompliancePercentage: 80,
        totalCheckpointsScanned: 8,
        totalCheckpointsCount: 10,
        totalObservationsCount: 0,
        routes: [],
      });

      expect(html).toContain('Employee</td>');
      expect(html).toContain('Habeeb Guard (EMP-000017)');
      expect(html).not.toContain('Security Officer</td>');
      expect(html).toContain('SECURITY');
    });

    it('3. Supervisor email displays Employee label with Role: SUPERVISOR', () => {
      const html = buildConsolidatedRouteCycleEmailHtml({
        officerName: 'Varinder Supervisor',
        employeeId: 'EMP-000001',
        officerRole: 'SUPERVISOR',
        siteName: 'Atlabs Tower 1',
        shiftName: 'Full time',
        cycleDate: '29 Oct 2026',
        assignedRoutesCount: 1,
        completedRoutesCount: 1,
        overallCompliancePercentage: 100,
        totalCheckpointsScanned: 3,
        totalCheckpointsCount: 3,
        totalObservationsCount: 0,
        routes: [],
      });

      expect(html).toContain('Employee</td>');
      expect(html).toContain('Varinder Supervisor (EMP-000001)');
      expect(html).not.toContain('Security Officer</td>');
      expect(html).toContain('SUPERVISOR');
    });

    it('4. Single patrol completion email also displays Employee label', () => {
      const html = buildPatrolCompletedEmailHtml({
        patrolCode: 'PATROL-SESSION-000119',
        officerName: 'Asif Khan',
        employeeId: 'EMP-000012',
        siteName: 'Atlabs Tower 1',
        routeName: '1st Floor',
        shiftName: 'Day Shift',
        startedAt: '4:28 PM',
        completedAt: '4:44 PM',
        scannedCount: 3,
        totalCount: 3,
        compliancePercentage: 100,
        observationsCount: 0,
        supervisorStatus: 'APPROVED',
        checkpoints: [],
        observations: [],
      });

      expect(html).toContain('Employee</td>');
      expect(html).toContain('Asif Khan (EMP-000012)');
      expect(html).not.toContain('Security Officer</td>');
    });

    it('5. Email layout structure, styling, and tables are preserved', () => {
      const html = buildConsolidatedRouteCycleEmailHtml({
        officerName: 'Asif Khan',
        employeeId: 'EMP-000012',
        officerRole: 'TECHNICIAN',
        siteName: 'Atlabs Tower 1',
        shiftName: 'Day Shift',
        cycleDate: '29 Oct 2026',
        assignedRoutesCount: 1,
        completedRoutesCount: 1,
        overallCompliancePercentage: 100,
        totalCheckpointsScanned: 5,
        totalCheckpointsCount: 5,
        totalObservationsCount: 0,
        routes: [],
      });

      expect(html).toContain('Hello Orbit');
      expect(html).toContain('ASSIGNED PATROL ROUTES COMPLETED');
      expect(html).toContain('Assignment Cycle Summary');
      expect(html).toContain('Monitored Site');
      expect(html).toContain('Assigned Routes');
      expect(html).toContain('Overall Compliance');
    });
  });

  describe('Task 2 — Fix 0/0 compliance calculation showing as 100%', () => {
    it('6. Mandatory Patrol 0/0 displays 0%', () => {
      expect(calculateCompliancePercentage(0, 0)).toBe(0);
      expect(calculateCheckpointCompliance(0, 0)).toBe(0);
    });

    it('7. Mandatory Patrol 0/1 displays 0%', () => {
      expect(calculateCompliancePercentage(0, 1)).toBe(0);
      expect(calculateCheckpointCompliance(1, 0)).toBe(0);
    });

    it('8. Mandatory Patrol 1/1 displays 100%', () => {
      expect(calculateCompliancePercentage(1, 1)).toBe(100);
      expect(calculateCheckpointCompliance(1, 1)).toBe(100);
    });

    it('9. Mandatory Patrol 3/5 displays 60%', () => {
      expect(calculateCompliancePercentage(3, 5)).toBe(60);
      expect(calculateCheckpointCompliance(5, 3)).toBe(60);
    });

    it('10. Checkpoint compliance 8/10 remains 80%', () => {
      expect(calculateCompliancePercentage(8, 10)).toBe(80);
      expect(calculateCheckpointCompliance(10, 8)).toBe(80);
    });

    it('11. Route completion 1/1 remains 100%', () => {
      expect(calculateCompliancePercentage(1, 1)).toBe(100);
    });

    it('12. Prevents NaN and Infinity on invalid or negative inputs', () => {
      expect(calculateCompliancePercentage(0, -5)).toBe(0);
      expect(calculateCompliancePercentage(-1, 0)).toBe(0);
      expect(calculateCompliancePercentage(NaN as any, 0)).toBe(0);
      expect(calculateCompliancePercentage(0, NaN as any)).toBe(0);
      expect(calculateCompliancePercentage(undefined as any, undefined as any)).toBe(0);
    });

    it('13. Caps compliance at 100% when completed exceeds total', () => {
      expect(calculateCompliancePercentage(12, 10)).toBe(100);
    });

    it('14. Preserves rounding conventions (8/11 = 73%)', () => {
      expect(calculateCompliancePercentage(8, 11)).toBe(73);
      expect(calculateCheckpointCompliance(11, 8)).toBe(73);
    });
  });
});

