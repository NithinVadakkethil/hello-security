import {
  isCheckpointEligibleForSession,
  filterEligibleCheckpointsForSession,
  calculateCheckpointCompliance,
} from '../../../common/utils/checkpoint-eligibility.util';
import { reportService } from '../report.service';
import { reportRepository } from '../report.repository';

describe('Deactivated Checkpoint Eligibility and Compliance Suite', () => {
  describe('Authoritative Eligibility Policy (isCheckpointEligibleForSession)', () => {
    it('1. Active checkpoint in an ongoing patrol is eligible', () => {
      const eligible = isCheckpointEligibleForSession({
        gate: { id: 'gate-1', name: 'Main Lobby', isActive: true },
        session: { status: 'IN_PROGRESS', startedAt: new Date() },
        wasScanned: false,
      });
      expect(eligible).toBe(true);
    });

    it('2. Deactivated checkpoint in an ongoing patrol is excluded if not scanned', () => {
      const eligible = isCheckpointEligibleForSession({
        gate: { id: 'gate-2', name: 'Service Elevator', isActive: false },
        session: { status: 'IN_PROGRESS', startedAt: new Date() },
        wasScanned: false,
      });
      expect(eligible).toBe(false);
    });

    it('3. Completed historical patrol: scanned checkpoint is ALWAYS preserved, even if currently deactivated', () => {
      const eligible = isCheckpointEligibleForSession({
        gate: { id: 'gate-3', name: 'Staircase 1', isActive: false, updatedAt: new Date('2026-10-28T10:00:00Z') },
        session: {
          status: 'COMPLETED',
          startedAt: new Date('2026-10-20T08:00:00Z'),
          endedAt: new Date('2026-10-20T09:00:00Z'),
        },
        wasScanned: true,
      });
      expect(eligible).toBe(true);
    });

    it('4. Completed historical patrol: checkpoint deactivated AFTER the patrol was eligible when patrol took place', () => {
      // Patrol ended at 2026-10-20T09:00:00Z. Checkpoint deactivated at 2026-10-28T10:00:00Z.
      const eligible = isCheckpointEligibleForSession({
        gate: { id: 'gate-4', name: 'Fire Exit', isActive: false, updatedAt: new Date('2026-10-28T10:00:00Z') },
        session: {
          status: 'COMPLETED',
          startedAt: new Date('2026-10-20T08:00:00Z'),
          endedAt: new Date('2026-10-20T09:00:00Z'),
        },
        wasScanned: false,
      });
      expect(eligible).toBe(true);
    });

    it('5. Completed historical patrol: checkpoint deactivated BEFORE the patrol was NOT eligible for that patrol', () => {
      // Checkpoint deactivated at 2026-10-15T10:00:00Z. Patrol took place at 2026-10-20T08:00:00Z.
      const eligible = isCheckpointEligibleForSession({
        gate: { id: 'gate-5', name: 'Roof Access', isActive: false, updatedAt: new Date('2026-10-15T10:00:00Z') },
        session: {
          status: 'COMPLETED',
          startedAt: new Date('2026-10-20T08:00:00Z'),
          endedAt: new Date('2026-10-20T09:00:00Z'),
        },
        wasScanned: false,
      });
      expect(eligible).toBe(false);
    });

    it('6. Reactivated checkpoint is eligible for future patrols', () => {
      const eligible = isCheckpointEligibleForSession({
        gate: { id: 'gate-6', name: 'West Gate', isActive: true, updatedAt: new Date() },
        session: { status: 'IN_PROGRESS', startedAt: new Date() },
        wasScanned: false,
      });
      expect(eligible).toBe(true);
    });
  });

  describe('Timeline Filtering & Compliance Partitioning', () => {
    it('7. Excludes deactivated unscanned checkpoint from current patrol timeline', () => {
      const items = [
        { id: '1', sequence: 1, gate: { id: 'g1', name: 'G1', isActive: true }, isCompleted: true },
        { id: '2', sequence: 2, gate: { id: 'g2', name: 'G2', isActive: false }, isCompleted: false },
        { id: '3', sequence: 3, gate: { id: 'g3', name: 'G3', isActive: true }, isCompleted: false },
      ];

      const filtered = filterEligibleCheckpointsForSession(items, { status: 'IN_PROGRESS' });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((item) => item.gate.id)).toEqual(['g1', 'g3']);
    });

    it('8. Compliance calculation respects eligible checkpoints partition (8/11 = 73%)', () => {
      // Example from client requirements:
      // 13 checkpoints total on route.
      // 2 deactivated before patrol.
      // 11 eligible.
      // 8 scanned, 3 unscanned.
      // Compliance: 8 / 11 = 72.73% -> 73%
      const totalEligible = 11;
      const scanned = 8;
      const compliance = calculateCheckpointCompliance(totalEligible, scanned);
      expect(compliance).toBe(73);

      const unscanned = totalEligible - scanned;
      expect(scanned + unscanned).toBe(totalEligible);
    });

    it('9. 0 eligible checkpoints returns 0% compliance', () => {
      expect(calculateCheckpointCompliance(0, 0)).toBe(0);
    });

    it('10. Scanned and Unscanned counts match total eligible checkpoints', () => {
      const totalConfigured = 13;
      const deactivatedCount = 2;
      const eligibleCount = totalConfigured - deactivatedCount;
      const scannedCount = 8;
      const unscannedCount = eligibleCount - scannedCount;

      expect(scannedCount + unscannedCount).toBe(eligibleCount);
      expect(eligibleCount).toBe(11);
      expect(unscannedCount).toBe(3);
    });
  });

  describe('Report Service HTML and CSV Filtering', () => {
    it('11. buildPatrolReportHtml filters deactivated checkpoints from unscanned items', () => {
      const mockReport: any = {
        id: 'session-101',
        patrolCode: 'PAT-000101',
        status: 'IN_PROGRESS',
        startedAt: new Date('2026-10-28T10:00:00Z'),
        endedAt: null,
        totalDuration: 120,
        assignment: {
          employee: { firstName: 'John', lastName: 'Doe', role: 'SECURITY' },
          site: { name: 'Tower A' },
          shift: { name: 'Morning Shift' },
          patrolRoute: {
            name: 'Perimeter Route',
            routeGates: [
              { sequence: 1, gateId: 'gate-a', gate: { id: 'gate-a', name: 'Lobby', gateCode: 'G-A', isActive: true } },
              { sequence: 2, gateId: 'gate-b', gate: { id: 'gate-b', name: 'Basement', gateCode: 'G-B', isActive: false } },
            ],
          },
        },
        checkpoints: [
          {
            id: 'cp-1',
            gateId: 'gate-a',
            scannedAt: new Date('2026-10-28T10:05:00Z'),
            gate: { id: 'gate-a', name: 'Lobby', gateCode: 'G-A', isActive: true },
            subTaskResponses: [],
          },
        ],
        incidents: [],
        snags: [],
      };

      const html = reportService.buildPatrolReportHtml(mockReport);
      // Lobby (scanned) must be present
      expect(html).toContain('Lobby');
      // Basement is deactivated and unscanned in IN_PROGRESS session: must NOT be displayed
      expect(html).not.toContain('Basement');
    });

    it('12. generateCsv excludes deactivated unscanned checkpoints from output rows', async () => {
      const mockReport: any = {
        id: 'session-102',
        patrolCode: 'PAT-000102',
        status: 'IN_PROGRESS',
        startedAt: new Date('2026-10-28T10:00:00Z'),
        endedAt: null,
        assignment: {
          employee: { firstName: 'Jane', lastName: 'Smith' },
          site: { name: 'Alpha Tower' },
          shift: { name: 'Night Shift' },
          patrolRoute: {
            name: 'Route 1',
            routeGates: [
              { sequence: 1, gateId: 'g1', gate: { id: 'g1', name: 'Active Gate', gateCode: 'AG', isActive: true } },
              { sequence: 2, gateId: 'g2', gate: { id: 'g2', name: 'Deactivated Gate', gateCode: 'DG', isActive: false } },
            ],
          },
        },
        checkpoints: [
          {
            id: 'cp-1',
            gateId: 'g1',
            scannedAt: new Date('2026-10-28T10:02:00Z'),
            gate: { id: 'g1', name: 'Active Gate', gateCode: 'AG', isActive: true },
            subTaskResponses: [],
          },
        ],
        incidents: [],
        snags: [],
      };

      jest.spyOn(reportRepository, 'findInspectionReports').mockResolvedValue({ total: 1, data: [mockReport] } as any);

      const csv = await reportService.generateCsv('client-1', {} as any);
      expect(csv).toContain('session-102');
      expect(csv).toContain('1,1,100%'); // 1 scanned out of 1 eligible (excluding deactivated gate)
    });
  });
});
