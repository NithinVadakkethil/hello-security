import {
  isSystemSyncRemark,
  cleanSystemRemark,
  extractPatrolObservations,
} from '../observation-metadata.util';
import {
  buildPatrolCompletedEmailHtml,
  buildConsolidatedRouteCycleEmailHtml,
} from '../../email/templates/patrol-completed.template';

describe('Observation Metadata & Patrol Completion Email Synchronization Suite', () => {
  describe('Task 3 — isSystemSyncRemark & cleanSystemRemark classification', () => {
    it('1. Correctly identifies exact system sync catch-up messages', () => {
      expect(isSystemSyncRemark('Auto-completed during sync catch-up')).toBe(true);
      expect(isSystemSyncRemark('  Auto-completed during sync catch-up  ')).toBe(true);
      expect(isSystemSyncRemark('Auto-completed upon starting a new patrol session.')).toBe(true);
    });

    it('2. Correctly identifies structured system metadata prefixes', () => {
      expect(isSystemSyncRemark('[SYSTEM:SYNC_RECONCILIATION] Auto-completed during sync catch-up')).toBe(true);
      expect(isSystemSyncRemark('[SYSTEM] Automated sweep')).toBe(true);
      expect(isSystemSyncRemark('[SYSTEM:OFFLINE_RECONCILIATION] Task completed')).toBe(true);
    });

    it('3. Never falsely identifies genuine employee remarks containing "sync" or "completed"', () => {
      expect(isSystemSyncRemark('Synchronized with building management about HVAC')).toBe(false);
      expect(isSystemSyncRemark('Completed repair on fire hose reel')).toBe(false);
      expect(isSystemSyncRemark('Sync cable on camera 4 is loose')).toBe(false);
      expect(isSystemSyncRemark('All tasks completed by security guard')).toBe(false);
    });

    it('4. Returns false for ordinary employee inspection remarks', () => {
      expect(isSystemSyncRemark('Fire hose cabinet glass is broken')).toBe(false);
      expect(isSystemSyncRemark('Emergency light in corridor flickers')).toBe(false);
      expect(isSystemSyncRemark('Everything in order')).toBe(false);
    });

    it('5. Returns false for null, undefined, empty, or whitespace-only remarks', () => {
      expect(isSystemSyncRemark(null)).toBe(false);
      expect(isSystemSyncRemark(undefined)).toBe(false);
      expect(isSystemSyncRemark('')).toBe(false);
      expect(isSystemSyncRemark('   ')).toBe(false);
    });

    it('6. cleanSystemRemark strips prefix cleanly', () => {
      expect(cleanSystemRemark('[SYSTEM:SYNC_RECONCILIATION] Auto-completed during sync catch-up')).toBe(
        'Auto-completed during sync catch-up',
      );
      expect(cleanSystemRemark('Auto-completed during sync catch-up')).toBe(
        'Auto-completed during sync catch-up',
      );
      expect(cleanSystemRemark(null)).toBeNull();
    });
  });

  describe('Task 4 & 5 — extractPatrolObservations filtering, deduplication & integrity', () => {
    it('7. Excludes internal sync catch-up messages from observations', () => {
      const mockSession = {
        checkpoints: [
          {
            gate: { name: 'FACP - FCC ROOM' },
            subTaskResponses: [
              {
                gateSubTaskId: 'st-1',
                taskNameSnapshot: 'Main AC Power Normal',
                answer: 'YES',
                remarks: 'Auto-completed during sync catch-up',
              },
              {
                gateSubTaskId: 'st-2',
                taskNameSnapshot: 'Battery Backup Healthy',
                answer: 'YES',
                remarks: 'Auto-completed during sync catch-up',
              },
            ],
          },
        ],
      };

      const obs = extractPatrolObservations(mockSession);
      expect(obs).toHaveLength(0);
    });

    it('8. Preserves genuine employee remarks on checkpoints and subtasks', () => {
      const mockSession = {
        checkpoints: [
          {
            gate: { name: 'FACP - FCC ROOM' },
            remarks: 'Panel cabinet lock was difficult to open',
            subTaskResponses: [
              {
                gateSubTaskId: 'st-1',
                taskNameSnapshot: 'Main AC Power Normal',
                answer: 'YES',
                remarks: 'Auto-completed during sync catch-up', // system -> excluded
              },
              {
                gateSubTaskId: 'st-2',
                taskNameSnapshot: 'Alarm Bell Operational',
                answer: 'YES',
                remarks: 'Slight delay in bell chime', // genuine employee note
              },
            ],
          },
        ],
      };

      const obs = extractPatrolObservations(mockSession);
      expect(obs).toHaveLength(2);
      expect(obs[0].title).toBe('Checkpoint: FACP - FCC ROOM — Officer Note');
      expect(obs[0].description).toBe('Panel cabinet lock was difficult to open');
      expect(obs[1].title).toBe('Checkpoint: FACP - FCC ROOM — Alarm Bell Operational Note');
      expect(obs[1].description).toBe('Slight delay in bell chime');
    });

    it('9. Captures negative inspection answers (answer === NO) as defects with HIGH severity', () => {
      const mockSession = {
        checkpoints: [
          {
            gate: { name: 'Water Pump Room' },
            subTaskResponses: [
              {
                gateSubTaskId: 'st-pump-1',
                taskNameSnapshot: 'Pressure Gauge Normal',
                answer: 'NO',
                remarks: 'Pressure dropped to 1.2 bar (below minimum threshold)',
              },
            ],
          },
        ],
      };

      const obs = extractPatrolObservations(mockSession);
      expect(obs).toHaveLength(1);
      expect(obs[0].title).toBe('Checkpoint: Water Pump Room — Failed Check: Pressure Gauge Normal');
      expect(obs[0].description).toBe('Remark: Pressure dropped to 1.2 bar (below minimum threshold)');
      expect(obs[0].severity).toBe('HIGH');
    });

    it('10. Captures negative inspection answer even when remarks are omitted by employee', () => {
      const mockSession = {
        checkpoints: [
          {
            gate: { name: 'Roof Access Door' },
            subTaskResponses: [
              {
                gateSubTaskId: 'st-door-1',
                taskNameSnapshot: 'Door Latched and Secured',
                answer: 'NO',
                remarks: null,
              },
            ],
          },
        ],
      };

      const obs = extractPatrolObservations(mockSession);
      expect(obs).toHaveLength(1);
      expect(obs[0].title).toBe('Checkpoint: Roof Access Door — Failed Check: Door Latched and Secured');
      expect(obs[0].description).toBe('Task verification failed (Answer: NO)');
    });

    it('11. Deduplicates multiple identical remarks occurring from retry synchronization', () => {
      const mockSession = {
        checkpoints: [
          {
            gate: { name: 'Basement Parking 1' },
            remarks: 'Water leakage near bay 14',
          },
          {
            gate: { name: 'Basement Parking 1' },
            remarks: 'Water leakage near bay 14', // identical duplicate from retry
          },
        ],
      };

      const obs = extractPatrolObservations(mockSession);
      expect(obs).toHaveLength(1);
      expect(obs[0].title).toBe('Checkpoint: Basement Parking 1 — Officer Note');
      expect(obs[0].description).toBe('Water leakage near bay 14');
    });

    it('12. Includes reported incidents and snags without duplicating auto-generated subtask incidents', () => {
      const mockSession = {
        checkpoints: [
          {
            gate: { name: 'Electric Room' },
            subTaskResponses: [
              {
                gateSubTaskId: 'st-elec-1',
                taskNameSnapshot: 'Panel Cover Intact',
                answer: 'NO',
                remarks: 'Panel cover unhinged',
              },
            ],
          },
        ],
        incidents: [
          // Auto-generated incident created by backend when answer === NO
          {
            title: 'Panel Cover Intact',
            description: 'Sub-Task Answer: NO (Panel Cover Intact)\nOfficer Role: SECURITY',
          },
          // Independent incident logged by officer
          {
            title: 'Unattended Toolbox',
            description: 'Contractor left metal toolbox in corridor',
            severity: 'LOW',
          },
        ],
        snags: [
          {
            title: 'Exposed wire conduit',
            description: 'Conduit cracked near ceiling',
          },
        ],
      };

      const obs = extractPatrolObservations(mockSession);
      // Expected:
      // 1. Failed check: Panel Cover Intact
      // 2. Incident: Unattended Toolbox (auto-generated incident is skipped to avoid double-reporting)
      // 3. Snag: Exposed wire conduit
      expect(obs).toHaveLength(3);
      expect(obs[0].title).toContain('Failed Check: Panel Cover Intact');
      expect(obs[1].title).toBe('Incident: Unattended Toolbox');
      expect(obs[2].title).toBe('Snag / Defect: Exposed wire conduit');
    });
  });

  describe('Task 3, 4, 7 — Patrol Email Template Rendering Parity', () => {
    it('13. Consolidated email renders clean neutral message when all catch-up messages are filtered', () => {
      const html = buildConsolidatedRouteCycleEmailHtml({
        officerName: 'Manoj Guard',
        employeeId: 'EMP-000045',
        officerRole: 'SECURITY',
        siteName: 'KAIZEN – PENINSULA 1',
        shiftName: 'Day Shift',
        cycleDate: '04 Nov 2026',
        assignedRoutesCount: 1,
        completedRoutesCount: 1,
        overallCompliancePercentage: 100,
        totalCheckpointsScanned: 6,
        totalCheckpointsCount: 6,
        totalObservationsCount: 0,
        routes: [
          {
            routeName: 'Tower 1 Perimeter',
            patrolCode: 'PATROL-SESSION-000551',
            scannedCount: 6,
            totalCount: 6,
            compliancePercentage: 100,
            observationsCount: 0,
            completedAt: '03:45 PM',
            checkpoints: [],
            // Even if raw system sync remarks were passed in routes observations:
            observations: [
              {
                title: 'Checkpoint: FACP - FCC ROOM — Subtask Remark',
                description: 'Auto-completed during sync catch-up',
              },
              {
                title: 'Checkpoint: FACP - FCC ROOM — Subtask Remark',
                description: 'Auto-completed during sync catch-up',
              },
            ],
          },
        ],
      });

      // Must NOT contain internal sync message
      expect(html).not.toContain('Auto-completed during sync catch-up');
      expect(html).not.toContain('Subtask Remark');
      // Must NOT contain red observation warning cards
      expect(html).not.toContain('⚠️');
      // Must render clean neutral empty state
      expect(html).toContain('No observations reported across the completed assignment cycle.');
    });

    it('14. Consolidated email cleanly renders genuine employee observations with route names and warning badge', () => {
      const html = buildConsolidatedRouteCycleEmailHtml({
        officerName: 'Manoj Guard',
        employeeId: 'EMP-000045',
        officerRole: 'SECURITY',
        siteName: 'KAIZEN – PENINSULA 1',
        shiftName: 'Day Shift',
        cycleDate: '04 Nov 2026',
        assignedRoutesCount: 1,
        completedRoutesCount: 1,
        overallCompliancePercentage: 100,
        totalCheckpointsScanned: 6,
        totalCheckpointsCount: 6,
        totalObservationsCount: 1,
        routes: [
          {
            routeName: 'Tower 1 Perimeter',
            patrolCode: 'PATROL-SESSION-000551',
            scannedCount: 6,
            totalCount: 6,
            compliancePercentage: 100,
            observationsCount: 1,
            completedAt: '03:45 PM',
            checkpoints: [],
            observations: [
              {
                title: 'Checkpoint: FACP - FCC ROOM — Main AC Power Note',
                description: 'Minor buzzing sound from inverter',
              },
            ],
          },
        ],
      });

      expect(html).toContain('Tower 1 Perimeter');
      expect(html).toContain('⚠️ Checkpoint: FACP - FCC ROOM — Main AC Power Note');
      expect(html).toContain('Minor buzzing sound from inverter');
      expect(html).not.toContain('No observations reported across the completed assignment cycle.');
    });

    it('15. Single patrol completion email also filters internal catch-up metadata', () => {
      const html = buildPatrolCompletedEmailHtml({
        patrolCode: 'PATROL-SESSION-000552',
        officerName: 'Habeeb Guard',
        employeeId: 'EMP-000088',
        siteName: 'Marina 101',
        routeName: 'Floor 19',
        shiftName: 'Day Shift',
        startedAt: '1:00 PM',
        completedAt: '1:15 PM',
        scannedCount: 4,
        totalCount: 4,
        compliancePercentage: 100,
        observationsCount: 0,
        supervisorStatus: 'APPROVED',
        checkpoints: [],
        observations: [
          {
            title: 'Checkpoint: FACP - FCC ROOM — Subtask Remark',
            description: 'Auto-completed during sync catch-up',
          },
        ],
      });

      expect(html).not.toContain('Auto-completed during sync catch-up');
      expect(html).toContain('No observations reported.');
    });
  });
});
