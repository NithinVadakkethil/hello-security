import {
  calculatePatrolDurationSeconds,
  formatSecondsToDuration,
  formatPatrolDuration,
  resolveCheckpointTiming,
} from '../../../common/utils/date-formatter.util';
import { reportService } from '../report.service';

describe('Patrol Inspection Report Enhancements (Regression & Feature Suite)', () => {
  describe('Requirement A & F: Duration Calculation and Formatting', () => {
    it('1. Patrol lasting 55 seconds displays "55 sec"', () => {
      expect(formatSecondsToDuration(55)).toBe('55 sec');
      const start = '2026-10-02T17:08:07.082Z';
      const end = '2026-10-02T17:09:02.234Z';
      const seconds = calculatePatrolDurationSeconds(start, end);
      expect(seconds).toBe(55);
      expect(formatPatrolDuration({ startedAt: start, endedAt: end, status: 'COMPLETED' })).toBe('55 sec');
    });

    it('2. Patrol lasting 2 minutes 35 seconds displays "2 min 35 sec"', () => {
      const seconds = 2 * 60 + 35; // 155s
      expect(formatSecondsToDuration(seconds)).toBe('2 min 35 sec');
      const start = '2026-10-02T10:00:00.000Z';
      const end = '2026-10-02T10:02:35.000Z';
      expect(calculatePatrolDurationSeconds(start, end)).toBe(155);
      expect(formatPatrolDuration({ startedAt: start, endedAt: end, status: 'COMPLETED' })).toBe('2 min 35 sec');
    });

    it('3. Patrol lasting over one hour displays correct hours, minutes, and seconds', () => {
      // 3,600 seconds -> 1 hr 0 min 0 sec
      expect(formatSecondsToDuration(3600)).toBe('1 hr 0 min 0 sec');
      // 4,328 seconds -> 1 hr 12 min 8 sec
      expect(formatSecondsToDuration(4328)).toBe('1 hr 12 min 8 sec');
      const start = '2026-10-02T08:00:00.000Z';
      const end = '2026-10-02T09:12:08.000Z';
      expect(calculatePatrolDurationSeconds(start, end)).toBe(4328);
      expect(formatPatrolDuration({ startedAt: start, endedAt: end, status: 'COMPLETED' })).toBe('1 hr 12 min 8 sec');
    });

    it('4. Patrol crossing midnight calculates correctly', () => {
      // From 23:58:30 on Oct 2 to 00:02:15 on Oct 3 -> 3 min 45 sec (225 sec)
      const start = '2026-10-02T23:58:30.000Z';
      const end = '2026-10-03T00:02:15.000Z';
      const seconds = calculatePatrolDurationSeconds(start, end);
      expect(seconds).toBe(225);
      expect(formatPatrolDuration({ startedAt: start, endedAt: end, status: 'COMPLETED' })).toBe('3 min 45 sec');
    });

    it('5. Patrol with missing completion timestamp is handled safely without fabricating duration', () => {
      const start = '2026-10-02T10:00:00.000Z';
      // Without endedAt and status !== IN_PROGRESS
      expect(calculatePatrolDurationSeconds(start, null)).toBeNull();
      expect(formatPatrolDuration({ startedAt: start, endedAt: null, status: 'PENDING' })).toBe('—');
      // In progress shows (In Progress)
      expect(formatPatrolDuration({ startedAt: start, endedAt: null, status: 'IN_PROGRESS' })).toContain('(In Progress)');
      // Missing both timestamps
      expect(formatPatrolDuration({})).toBe('—');
    });

    it('6. Patrol with invalid or reversed timestamps is flagged rather than displayed as zero', () => {
      const start = '2026-10-02T10:05:00.000Z';
      const end = '2026-10-02T10:00:00.000Z'; // Ended before started
      expect(calculatePatrolDurationSeconds(start, end)).toBeNull();
      expect(formatPatrolDuration({ startedAt: start, endedAt: end, status: 'COMPLETED' })).toBe('Invalid Duration');

      // Invalid date string
      expect(calculatePatrolDurationSeconds('invalid-date', 'another-bad-date')).toBeNull();
      expect(formatPatrolDuration({ startedAt: 'invalid-date', endedAt: 'another-bad-date' })).toBe('Invalid Duration');
    });

    it('7. Reference fixture PATROL-SESSION-1789967048777 returns 55 sec', () => {
      const fixtureSession = {
        id: 'cmsh1patrol0001',
        patrolCode: 'PATROL-SESSION-1789967048777',
        startedAt: new Date('2026-10-02T17:08:07.082Z'),
        endedAt: new Date('2026-10-02T17:09:02.234Z'),
        status: 'COMPLETED',
        totalDuration: 0, // Old bug stored 0
      };
      // Authoritative calculation resolves timestamp difference directly
      expect(formatPatrolDuration(fixtureSession)).toBe('55 sec');
    });
  });

  const mockReportData = {
    patrolCode: 'PATROL-SESSION-1789967048777',
    startedAt: '2026-10-02T17:08:07.082Z',
    endedAt: '2026-10-02T17:09:02.234Z',
    status: 'COMPLETED',
    officerName: 'John Doe Guard',
    employeeCode: 'EMP-00142',
    employeeRole: 'SECURITY',
    assignment: {
      employee: {
        firstName: 'John',
        lastName: 'Doe Guard',
        employeeNumber: 'EMP-00142',
        role: 'SECURITY',
      },
      site: {
        name: 'Marina Gate Tower 1',
        address: 'Dubai Marina, Dubai, UAE',
      },
      patrolRoute: {
        name: 'Main Perimeter Route',
      },
      shift: {
        name: 'Night',
        startTime: '21:00',
        endTime: '09:00',
      },
    },
    client: {
      companyName: 'Kaizen Properties LLC',
    },
    checkpoints: [
      {
        id: 'cp-1',
        gate: { id: 'g-1', name: 'Main Gate', checkpointCode: 'CP-01' },
        status: 'COMPLETED',
        scannedAt: '2026-10-02T17:08:20.000Z',
        subTaskResponses: [
          {
            gateSubTaskId: 'task-1',
            taskName: 'Check main entry locks',
            role: 'SECURITY',
            answer: 'YES',
            remarks: 'All secure',
          },
        ],
      },
      {
        id: 'cp-2',
        gate: { id: 'g-2', name: 'Basement Parking', checkpointCode: 'CP-02' },
        status: 'PENDING',
      },
    ],
  };

  describe('Requirements B, C, D, E: PDF Report Structure and Content', () => {

    it('8. Restored original PATROL DETAILS table layout without four-card redesign', () => {
      const html = reportService.buildPatrolReportHtml(mockReportData);

      // Section heading and table
      expect(html).toContain('PATROL DETAILS');
      expect(html).toContain('rpt-details-table');
      expect(html).not.toContain('rpt-meta-grid');

      // Row 1: Employee and Company Name
      expect(html).toContain('Employee');
      expect(html).toContain('John Doe Guard');
      expect(html).toContain('Company Name');
      expect(html).toContain('Kaizen Properties LLC');

      // Row 2: Employee ID and Emirates ID
      expect(html).toContain('Employee ID');
      expect(html).toContain('EMP-00142');
      expect(html).toContain('Emirates ID');
      expect(html).toContain('Marina Gate Tower 1');

      // Row 3: Role and Shift
      expect(html).toContain('Role');
      expect(html).toContain('SECURITY');
      expect(html).toContain('Shift');
      expect(html).toContain('Night (21:00 - 09:00)');

      // Row 4: Route / Target and Supervisor Status
      expect(html).toContain('Route / Target');
      expect(html).toContain('Main Perimeter Route');
      expect(html).toContain('Supervisor Status');

      // Row 5: Started and Patrol Status
      expect(html).toContain('Started');
      expect(html).toContain('Patrol Status');
      expect(html).toContain('COMPLETED');

      // Row 6: Completed and Patrol Duration (replacing Compliance / Score)
      expect(html).toContain('Completed');
      expect(html).toContain('Patrol Duration');
      expect(html).toContain('55 sec');
    });

    it('9. Replaced ONLY Compliance / Score with Patrol Duration in the PATROL DETAILS table', () => {
      const html = reportService.buildPatrolReportHtml(mockReportData);

      // The PATROL DETAILS table must not contain Compliance / Score
      const topSectionEndIndex = html.indexOf('PATROL COMPLIANCE SUMMARY');
      expect(topSectionEndIndex).toBeGreaterThan(0);
      const topSectionHtml = html.substring(0, topSectionEndIndex);

      expect(topSectionHtml).not.toContain('Compliance / Score');
      expect(topSectionHtml).toContain('Patrol Duration');
      expect(topSectionHtml).toContain('55 sec');
    });

    it('10. Checkpoint compliance KPI summary and detailed timeline remain intact', () => {
      const html = reportService.buildPatrolReportHtml(mockReportData);

      // PATROL COMPLIANCE SUMMARY is preserved
      expect(html).toContain('PATROL COMPLIANCE SUMMARY');
      expect(html).toContain('Scanned Gates');
      expect(html).toContain('Pending Gates to Scan');
      expect(html).toContain('Gate Compliance');

      // Detailed timeline is preserved
      expect(html).toContain('DETAILED CHECKPOINT TIMELINE');
      expect(html).toContain('Main Gate');
      expect(html).toContain('Check main entry locks');
      expect(html).toContain('All secure');
    });

    it('11. Handles extremely long employee, route, and site names safely in table layout', () => {
      const longReportData = {
        ...mockReportData,
        assignment: {
          ...mockReportData.assignment,
          employee: {
            ...mockReportData.assignment.employee,
            firstName: 'A'.repeat(50),
            lastName: 'B'.repeat(50),
          },
          site: {
            name: 'Super Long Monitored Commercial Logistics Complex Phase 4 Building C & D',
            address: 'Plot 998, Sector 4, Extremely Long Industrial Avenue, City Zone, UAE',
          },
          patrolRoute: {
            name: 'Comprehensive Outer Boundary Security Route Including Perimeter Fencing and Gates',
          },
        },
      };

      const html = reportService.buildPatrolReportHtml(longReportData);
      expect(html).toContain('Super Long Monitored Commercial Logistics Complex Phase 4 Building C & D');
      expect(html).toContain('rpt-details-table');
    });
  });

  describe('Requirement: Checkpoint Start Time, End Time, and Duration (Scenarios A through F and Historical)', () => {
    it('12. Scenario A: Completed checkpoint with subtasks resolves accurate Start, End, and Duration (e.g. 2 min 25 sec)', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-02T17:10:09.000Z',
        completedAt: '2026-10-02T17:12:34.000Z',
        tasks: [
          { answer: 'YES', isRequired: true, answeredAt: '2026-10-02T17:12:34.000Z' },
          { answer: 'YES', isRequired: true, answeredAt: '2026-10-02T17:12:34.000Z' },
          { answer: 'YES', isRequired: true, answeredAt: '2026-10-02T17:12:34.000Z' },
        ],
      });

      expect(timing.startTimeFormatted).toBe('9:10:09 PM');
      expect(timing.endTimeFormatted).toBe('9:12:34 PM');
      expect(timing.durationFormatted).toBe('2 min 25 sec');
      expect(timing.rawDurationSeconds).toBe(145);
      expect(timing.isCompleted).toBe(true);
      expect(timing.isIncomplete).toBe(false);
    });

    it('13. Scenario B: Checkpoint without subtasks completed instantaneously resolves 0 sec duration', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-02T17:10:09.000Z',
        tasks: [],
        subTaskResponses: [],
      });

      expect(timing.startTimeFormatted).toBe('9:10:09 PM');
      expect(timing.endTimeFormatted).toBe('9:10:09 PM');
      expect(timing.durationFormatted).toBe('0 sec');
      expect(timing.rawDurationSeconds).toBe(0);
      expect(timing.isCompleted).toBe(true);
    });

    it('14. Scenario C: Scanned but incomplete checkpoint displays End Time as "Not completed" and Duration as "Incomplete"', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-02T17:10:09.000Z',
        tasks: [
          { isRequired: true, answer: 'UNANSWERED' },
          { isRequired: true, answer: 'YES' },
        ],
      });

      expect(timing.startTimeFormatted).toBe('9:10:09 PM');
      expect(timing.endTimeFormatted).toBe('Not completed');
      expect(timing.durationFormatted).toBe('Incomplete');
      expect(timing.isIncomplete).toBe(true);
    });

    it('15. Scenario D: Unscanned checkpoint displays "—" for Start, End, and Duration', () => {
      const timing = resolveCheckpointTiming({
        scanned: false,
        scannedAt: null,
      });

      expect(timing.startTimeFormatted).toBe('—');
      expect(timing.endTimeFormatted).toBe('—');
      expect(timing.durationFormatted).toBe('—');
      expect(timing.isPending).toBe(true);
    });

    it('16. Scenario E & F: Duration calculations below 1 minute, over 1 hour, and crossing midnight', () => {
      // Below 1 minute: 45 seconds -> "45 sec"
      const t45 = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-02T17:00:00.000Z',
        completedAt: '2026-10-02T17:00:45.000Z',
      });
      expect(t45.durationFormatted).toBe('45 sec');

      // Over 1 hour: 1 hour 3 minutes -> "1 hr 3 min 0 sec"
      const tHour = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-02T17:00:00.000Z',
        completedAt: '2026-10-02T18:03:00.000Z',
      });
      expect(tHour.durationFormatted).toBe('1 hr 3 min 0 sec');

      // Crossing midnight
      const tMidnight = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-02T23:58:00.000Z',
        completedAt: '2026-10-03T00:02:15.000Z',
      });
      expect(tMidnight.durationFormatted).toBe('4 min 15 sec');
    });

    it('17. Section 9: Historical records missing explicit completion timestamps display "Not recorded" / "Not available"', () => {
      // Historical record: subtasks answeredAt == scannedAt, no completedAt recorded
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-02T17:10:09.000Z',
        tasks: [
          { answer: 'YES', isRequired: true, answeredAt: '2026-10-02T17:10:09.000Z' },
        ],
      });

      expect(timing.startTimeFormatted).toBe('9:10:09 PM');
      expect(timing.endTimeFormatted).toBe('Not recorded');
      expect(timing.durationFormatted).toBe('Not available');
      expect(timing.isHistoricalUnrecorded).toBe(true);
    });

    it('18. Detailed Checkpoint Timeline in HTML includes Start Time, End Time, and Duration', () => {
      const reportWithCompletedCheckpoints = {
        ...mockReportData,
        checkpoints: [
          {
            id: 'cp-completed',
            gate: { id: 'g-1', name: 'Staircases 1 - 15th Floor', checkpointCode: 'GATE-000375' },
            status: 'COMPLETED',
            scannedAt: '2026-10-02T17:10:09.000Z',
            completedAt: '2026-10-02T17:12:34.000Z',
            subTaskResponses: [
              {
                gateSubTaskId: 'task-1',
                taskName: 'Check exit doors',
                role: 'SECURITY',
                answer: 'YES',
                answeredAt: '2026-10-02T17:12:34.000Z',
              },
            ],
          },
        ],
      };

      const html = reportService.buildPatrolReportHtml(reportWithCompletedCheckpoints);
      expect(html).toContain('DETAILED CHECKPOINT TIMELINE');
      expect(html).toContain('Start Time:</span> 9:10:09 PM');
      expect(html).toContain('End Time:</span> 9:12:34 PM');
      expect(html).toContain('Duration:</span> 2 min 25 sec');
    });

    it('19. Reference fixture PATROL-SESSION-000129 resolves Telephone Room 1 - GF and Parking area GF with valid completion timings', () => {
      const session000129 = {
        patrolCode: 'PATROL-SESSION-000129',
        startedAt: '2026-10-28T18:48:45.612Z',
        endedAt: '2026-10-28T18:55:21.782Z',
        status: 'COMPLETED',
        officerName: 'Aaliya Guard',
        employeeRole: 'SECURITY',
        assignment: {
          employee: {
            firstName: 'Aaliya',
            lastName: 'Guard',
            role: 'SECURITY',
          },
          patrolRoute: {
            routeGates: [
              {
                sequence: 1,
                gate: {
                  id: 'g-5',
                  name: 'Telephone Room 1 - GF',
                  gateCode: 'GATE-000005',
                  subTasks: [
                    { id: 'st-1', taskName: 'Check line', role: 'SECURITY', isRequired: true },
                    { id: 'st-2', taskName: 'Check breaker', role: 'SECURITY', isRequired: true },
                  ],
                },
              },
              {
                sequence: 2,
                gate: {
                  id: 'g-6',
                  name: 'Parking area GF',
                  gateCode: 'GATE-000006',
                  subTasks: [
                    { id: 'st-3', taskName: 'Check barriers', role: 'SECURITY', isRequired: true },
                  ],
                },
              },
              {
                sequence: 3,
                gate: {
                  id: 'g-4',
                  name: 'Reception Lobby and Corridor GF',
                  gateCode: 'GATE-000004',
                  subTasks: [],
                },
              },
            ],
          },
        },
        checkpoints: [
          {
            id: 'cp-1',
            gateId: 'g-5',
            gate: { id: 'g-5', name: 'Telephone Room 1 - GF', gateCode: 'GATE-000005' },
            scannedAt: '2026-10-28T18:54:02.559Z',
            completedAt: '2026-10-28T18:54:18.271Z',
            status: 'GOOD',
            subTaskResponses: [
              { gateSubTaskId: 'st-1', answer: 'YES', answeredAt: '2026-10-28T18:54:18.271Z' },
              { gateSubTaskId: 'st-2', answer: 'YES', answeredAt: '2026-10-28T18:54:18.271Z' },
            ],
          },
          {
            id: 'cp-2',
            gateId: 'g-6',
            gate: { id: 'g-6', name: 'Parking area GF', gateCode: 'GATE-000006' },
            scannedAt: '2026-10-28T18:55:02.086Z',
            completedAt: '2026-10-28T18:55:16.514Z',
            status: 'GOOD',
            subTaskResponses: [
              { gateSubTaskId: 'st-3', answer: 'YES', answeredAt: '2026-10-28T18:55:16.514Z' },
            ],
          },
        ],
      };

      const html = reportService.buildPatrolReportHtml(session000129);
      expect(html).toContain('Telephone Room 1 - GF');
      expect(html).toContain('Start Time:</span> 10:54:02 PM');
      expect(html).toContain('End Time:</span> 10:54:18 PM');
      expect(html).toContain('Duration:</span> 16 sec');

      expect(html).toContain('Parking area GF');
      expect(html).toContain('Start Time:</span> 10:55:02 PM');
      expect(html).toContain('End Time:</span> 10:55:16 PM');
      expect(html).toContain('Duration:</span> 14 sec');

      expect(html).toContain('Reception Lobby and Corridor GF');
      expect(html).toContain('PENDING SCAN');
    });

    it('20. Unmerged configured tasks correlate with subTaskResponses map in resolveCheckpointTiming', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-28T18:54:02.000Z',
        completedAt: '2026-10-28T18:54:18.000Z',
        tasks: [
          { id: 'st-gate-1', isRequired: true },
        ],
        subTaskResponses: [
          { gateSubTaskId: 'st-gate-1', answer: 'YES', answeredAt: '2026-10-28T18:54:18.000Z' },
        ],
      });

      expect(timing.isCompleted).toBe(true);
      expect(timing.isIncomplete).toBe(false);
      expect(timing.durationFormatted).toBe('16 sec');
      expect(timing.endTimeFormatted).toBe('10:54:18 PM');
    });
  });
});
