import React from 'react';
import { render, screen } from '@testing-library/react';
import DetailedReportModal from '../src/app/dashboard/reports/components/DetailedReportModal';
import SingleReportPrintTemplate from '../src/app/dashboard/reports/components/SingleReportPrintTemplate';
import { resolveCheckpointTiming } from '../src/lib/date-formatter';
import { buildCheckpointTimeline, getReportOfficerInfo } from '../src/lib/checkpoint-timeline';
import { filterEligibleCheckpointsForSession } from '../src/lib/checkpoint-eligibility';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('Checkpoint Timing Model & DetailedReportModal vs PDF Regression Suite', () => {
  // Reference fixture based on PATROL-SESSION-000129
  const patrolSession000129 = {
    id: 'cmvsgwybx04g7utix3z24evw2',
    patrolCode: 'PATROL-SESSION-000129',
    status: 'COMPLETED',
    startedAt: '2026-10-28T18:48:45.612Z',
    endedAt: '2026-10-28T18:55:21.782Z',
    assignment: {
      site: { id: 's-1', name: 'Atlabs Tower 1' },
      employee: {
        id: 'e-1',
        firstName: 'Aaliya',
        lastName: 'Guard',
        email: 'aaliya1@atlabs.ae',
        role: 'SECURITY',
        employeeNumber: 'EMP-00101',
      },
      patrolRoute: {
        id: 'r-1',
        name: 'Ground Floor',
        routeGates: [
          {
            sequence: 1,
            gate: {
              id: 'g-5',
              name: 'Telephone Room 1 - GF',
              gateCode: 'GATE-000005',
              isActive: true,
              subTasks: [
                { id: 'st-1', taskName: 'Check telephone line signal', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-2', taskName: 'Check main breaker switch', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-3', taskName: 'Verify emergency phone battery', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-4', taskName: 'Inspect wiring condition', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-5', taskName: 'Check door lock mechanism', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-6', taskName: 'Record room temperature', role: 'SECURITY', isRequired: true, isActive: true },
              ],
            },
          },
          {
            sequence: 2,
            gate: {
              id: 'g-6',
              name: 'Parking area GF',
              gateCode: 'GATE-000006',
              isActive: true,
              subTasks: [
                { id: 'st-7', taskName: 'Check vehicle barriers', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-8', taskName: 'Verify CCTV field of view', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-9', taskName: 'Check emergency exit paths', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-10', taskName: 'Inspect fire extinguishers', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-11', taskName: 'Verify lighting fixtures', role: 'SECURITY', isRequired: true, isActive: true },
                { id: 'st-12', taskName: 'Check pedestrian gates', role: 'SECURITY', isRequired: true, isActive: true },
              ],
            },
          },
          {
            sequence: 3,
            gate: {
              id: 'g-4',
              name: 'Reception Lobby and Corridor GF',
              gateCode: 'GATE-000004',
              isActive: true,
              subTasks: [],
            },
          },
          {
            sequence: 4,
            gate: {
              id: 'g-7',
              name: 'Office - GF',
              gateCode: 'GATE-000007',
              isActive: true,
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
        gate: {
          id: 'g-5',
          name: 'Telephone Room 1 - GF',
          gateCode: 'GATE-000005',
        },
        scannedAt: '2026-10-28T18:54:02.559Z',
        completedAt: '2026-10-28T18:54:18.271Z',
        status: 'GOOD',
        subTaskResponses: [
          { id: 'res-1', gateSubTaskId: 'st-1', answer: 'YES', answeredAt: '2026-10-28T18:54:18.271Z' },
          { id: 'res-2', gateSubTaskId: 'st-2', answer: 'YES', answeredAt: '2026-10-28T18:54:18.271Z' },
          { id: 'res-3', gateSubTaskId: 'st-3', answer: 'YES', answeredAt: '2026-10-28T18:54:18.271Z' },
          { id: 'res-4', gateSubTaskId: 'st-4', answer: 'YES', answeredAt: '2026-10-28T18:54:18.271Z' },
          { id: 'res-5', gateSubTaskId: 'st-5', answer: 'YES', answeredAt: '2026-10-28T18:54:18.271Z' },
          { id: 'res-6', gateSubTaskId: 'st-6', answer: 'YES', answeredAt: '2026-10-28T18:54:18.271Z' },
        ],
      },
      {
        id: 'cp-2',
        gateId: 'g-6',
        gate: {
          id: 'g-6',
          name: 'Parking area GF',
          gateCode: 'GATE-000006',
        },
        scannedAt: '2026-10-28T18:55:02.086Z',
        completedAt: '2026-10-28T18:55:16.514Z',
        status: 'GOOD',
        subTaskResponses: [
          { id: 'res-7', gateSubTaskId: 'st-7', answer: 'YES', answeredAt: '2026-10-28T18:55:16.514Z' },
          { id: 'res-8', gateSubTaskId: 'st-8', answer: 'YES', answeredAt: '2026-10-28T18:55:16.514Z' },
          { id: 'res-9', gateSubTaskId: 'st-9', answer: 'YES', answeredAt: '2026-10-28T18:55:16.514Z' },
          { id: 'res-10', gateSubTaskId: 'st-10', answer: 'YES', answeredAt: '2026-10-28T18:55:16.514Z' },
          { id: 'res-11', gateSubTaskId: 'st-11', answer: 'YES', answeredAt: '2026-10-28T18:55:16.514Z' },
          { id: 'res-12', gateSubTaskId: 'st-12', answer: 'YES', answeredAt: '2026-10-28T18:55:16.514Z' },
        ],
      },
    ],
  };

  describe('1. Reference Mismatch Resolution (PATROL-SESSION-000129)', () => {
    it('DetailedReportModal displays Start Time: 10:54:02 PM, End Time: 10:54:18 PM, Duration: 16 sec for Telephone Room 1 - GF', () => {
      render(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={patrolSession000129} />);

      // Checkpoint 1: Telephone Room 1 - GF
      expect(screen.getByText('Telephone Room 1 - GF')).toBeTruthy();
      expect(screen.getByText('CODE: GATE-000005')).toBeTruthy();

      // Checkpoint 2: Parking area GF
      expect(screen.getByText('Parking area GF')).toBeTruthy();
      expect(screen.getByText('CODE: GATE-000006')).toBeTruthy();

      // Verified timing values in Dubai timezone (UTC+4):
      // Found in both the modal view and the embedded SingleReportPrintTemplate:
      expect(screen.getAllByText('10:54:02 PM').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('10:54:18 PM').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/16 sec/).length).toBeGreaterThanOrEqual(1);

      expect(screen.getAllByText('10:55:02 PM').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('10:55:16 PM').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/14 sec/).length).toBeGreaterThanOrEqual(1);

      // Crucially, verify "Not completed" and "Incomplete" do NOT appear for completed checkpoints
      expect(screen.queryByText('Not completed')).toBeNull();
      expect(screen.queryByText('Duration: Incomplete')).toBeNull();
    });

    it('SingleReportPrintTemplate and DetailedReportModal share the exact same checkpoint timing model', () => {
      const { guardName, officerRole } = getReportOfficerInfo(patrolSession000129);
      const rawTimeline = buildCheckpointTimeline(patrolSession000129, guardName, officerRole);
      const timeline = filterEligibleCheckpointsForSession(rawTimeline, patrolSession000129);

      expect(timeline).toHaveLength(4);

      // Checkpoint 1
      const cp1Timing = resolveCheckpointTiming(timeline[0]);
      expect(cp1Timing.startTimeFormatted).toBe('10:54:02 PM');
      expect(cp1Timing.endTimeFormatted).toBe('10:54:18 PM');
      expect(cp1Timing.durationFormatted).toBe('16 sec');
      expect(cp1Timing.isCompleted).toBe(true);
      expect(cp1Timing.isIncomplete).toBe(false);

      // Checkpoint 2
      const cp2Timing = resolveCheckpointTiming(timeline[1]);
      expect(cp2Timing.startTimeFormatted).toBe('10:55:02 PM');
      expect(cp2Timing.endTimeFormatted).toBe('10:55:16 PM');
      expect(cp2Timing.durationFormatted).toBe('14 sec');
      expect(cp2Timing.isCompleted).toBe(true);
      expect(cp2Timing.isIncomplete).toBe(false);

      // Checkpoints 3 & 4 (unscanned)
      const cp3Timing = resolveCheckpointTiming(timeline[2]);
      expect(cp3Timing.startTimeFormatted).toBe('—');
      expect(cp3Timing.endTimeFormatted).toBe('—');
      expect(cp3Timing.durationFormatted).toBe('—');
      expect(cp3Timing.isPending).toBe(true);
    });
  });

  describe('2. Checkpoint Timing Scenarios (A through F & Historical)', () => {
    it('Scenario A: Checkpoint with single completed subtask', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-28T10:00:00.000Z',
        completedAt: '2026-10-28T10:00:25.000Z',
        tasks: [{ id: 't-1', isRequired: true, answer: 'YES' }],
      });
      expect(timing.durationFormatted).toBe('25 sec');
      expect(timing.isCompleted).toBe(true);
    });

    it('Scenario B: Checkpoint without subtasks resolves instantaneous 0 sec', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-28T10:00:00.000Z',
        tasks: [],
        subTaskResponses: [],
      });
      expect(timing.durationFormatted).toBe('0 sec');
      expect(timing.endTimeFormatted).toBe(timing.startTimeFormatted);
      expect(timing.isCompleted).toBe(true);
    });

    it('Scenario C: Scanned checkpoint with unanswered required subtasks displays "Not completed" and "Incomplete"', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-28T10:00:00.000Z',
        tasks: [
          { id: 't-1', isRequired: true, answer: 'UNANSWERED' },
          { id: 't-2', isRequired: true, answer: 'YES' },
        ],
      });
      expect(timing.endTimeFormatted).toBe('Not completed');
      expect(timing.durationFormatted).toBe('Incomplete');
      expect(timing.isIncomplete).toBe(true);
      expect(timing.isCompleted).toBe(false);
    });

    it('Scenario C (Response Map): Unmerged configured tasks correlate with subTaskResponses to determine completion', () => {
      // When tasks are passed as configured gate subtasks without answer pre-merged
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-28T18:54:02.000Z',
        completedAt: '2026-10-28T18:54:22.000Z',
        tasks: [
          { id: 'st-req-1', isRequired: true }, // no answer on task object directly
        ],
        subTaskResponses: [
          { gateSubTaskId: 'st-req-1', answer: 'YES', answeredAt: '2026-10-28T18:54:22.000Z' },
        ],
      });
      expect(timing.isCompleted).toBe(true);
      expect(timing.isIncomplete).toBe(false);
      expect(timing.durationFormatted).toBe('20 sec');
    });

    it('Scenario D: Unscanned checkpoint displays "—" for Start, End, and Duration', () => {
      const timing = resolveCheckpointTiming({
        scanned: false,
        scannedAt: null,
      });
      expect(timing.startTimeFormatted).toBe('—');
      expect(timing.endTimeFormatted).toBe('—');
      expect(timing.durationFormatted).toBe('—');
      expect(timing.isPending).toBe(true);
    });

    it('Scenario E: Checkpoint crossing midnight calculates duration accurately', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-28T23:59:10.000Z',
        completedAt: '2026-10-29T00:01:25.000Z',
        tasks: [{ id: 't-1', isRequired: true, answer: 'YES' }],
      });
      expect(timing.durationFormatted).toBe('2 min 15 sec');
      expect(timing.rawDurationSeconds).toBe(135);
      expect(timing.isCompleted).toBe(true);
    });

    it('Section 9: Historical checkpoint missing explicit completedAt but with distinct response times resolves duration', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-28T10:00:00.000Z',
        completedAt: null,
        tasks: [
          { id: 't-1', isRequired: true, answer: 'YES', answeredAt: '2026-10-28T10:01:45.000Z' },
        ],
      });
      expect(timing.durationFormatted).toBe('1 min 45 sec');
      expect(timing.isCompleted).toBe(true);
    });

    it('Section 9: Historical checkpoint with zero distinct completion timestamp displays "Not recorded" / "Not available"', () => {
      const timing = resolveCheckpointTiming({
        scanned: true,
        scannedAt: '2026-10-28T10:00:00.000Z',
        completedAt: null,
        tasks: [
          { id: 't-1', isRequired: true, answer: 'YES', answeredAt: '2026-10-28T10:00:00.000Z' },
        ],
      });
      expect(timing.endTimeFormatted).toBe('Not recorded');
      expect(timing.durationFormatted).toBe('Not available');
      expect(timing.isHistoricalUnrecorded).toBe(true);
    });
  });
});
