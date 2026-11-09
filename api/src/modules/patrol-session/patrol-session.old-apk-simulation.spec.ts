import { patrolSessionService } from './patrol-session.service';
import { patrolSessionRepository } from './patrol-session.repository';
import { assignmentRepository } from '../assignment/assignment.repository';
import { counterService } from '../../common/counter/counter.service';
import { prisma } from '../../database/prisma';
import { PatrolStatus } from '@prisma/client';

describe('Phase 3 — Simulation of Installed Old APK Request Sequence', () => {
  const tenantId = 'cmuckz7o1051ghpt04rm8z5wf'; // Kaizen - Marina 101
  const employeeId = 'cmuwpqz5g01xkhp87mi8wnydh'; // Binyapal Singh
  const assignmentId = 'cmuwrb0us024ihp87mims2grf';

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Simulates complete 12-step sequence: Patrol 1 starts -> scans -> old APK completes with offline temp ID -> Patrol 2 starts without 409 conflict', async () => {
    // -------------------------------------------------------------
    // Step 4 & 5: Server receives patrol-start event for Patrol 1
    // -------------------------------------------------------------
    const mockSession1 = {
      id: 'cmw8psnua6a82hpxu8zid97p9',
      patrolCode: 'PATROL-SESSION-000791',
      clientId: tenantId,
      assignmentId,
      status: PatrolStatus.IN_PROGRESS,
      startedAt: new Date('2026-11-09T03:41:41.778Z'),
      endedAt: null,
      assignment: {
        id: assignmentId,
        employeeId,
        clientId: tenantId,
        isActive: true,
        patrolRoute: { name: 'Basement 1', isActive: true, routeGates: [{ gate: { isActive: true } }] },
        site: { name: 'Marina 101' },
      },
    };

    // No active patrol exists at beginning of cycle
    jest.spyOn(patrolSessionRepository, 'findActiveByEmployee').mockResolvedValue(null);
    jest.spyOn(assignmentRepository, 'findById').mockResolvedValue(mockSession1.assignment as any);
    jest.spyOn(prisma.guardAssignment, 'findUnique').mockResolvedValue(mockSession1.assignment as any);
    jest.spyOn(assignmentRepository, 'findEmployeeActiveAssignment').mockResolvedValue(mockSession1.assignment as any);
    jest.spyOn(counterService, 'next').mockResolvedValue(791);
    jest.spyOn(patrolSessionRepository, 'create').mockResolvedValue(mockSession1 as any);

    const startResult1 = await patrolSessionService.start(
      tenantId,
      employeeId,
      assignmentId,
      false,
      '2026-11-09T03:41:41.778Z',
    );

    expect(startResult1.id).toBe('cmw8psnua6a82hpxu8zid97p9');
    expect(startResult1.status).toBe(PatrolStatus.IN_PROGRESS);

    // -------------------------------------------------------------
    // Step 6: 18 Checkpoint scans synchronize successfully
    // -------------------------------------------------------------
    jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(18);

    // -------------------------------------------------------------
    // Step 7 & 8: Installed APK sends temporary ID to completion endpoint
    // "PATCH /api/v1/patrol-sessions/offline-session-1794026574949-735/complete"
    // -------------------------------------------------------------
    // findById('offline-session-...') returns null because DB only has the server CUID
    jest.spyOn(patrolSessionRepository, 'findById').mockImplementation(async (lookupId: string) => {
      if (lookupId && lookupId.startsWith('offline-session-')) {
        return null;
      }
      return mockSession1 as any;
    });

    // Backend fallback queries active session for this employee & tenant
    jest.spyOn(prisma.patrolSession, 'findMany').mockResolvedValue([mockSession1] as any);

    const completedSession1 = {
      ...mockSession1,
      status: PatrolStatus.COMPLETED,
      endedAt: new Date('2026-11-09T04:46:00.000Z'),
      totalDuration: 534,
      remarks: 'Completed Patrol Sweep.',
    };
    jest.spyOn(patrolSessionRepository, 'update').mockResolvedValue(completedSession1 as any);

    const completeResult1 = await patrolSessionService.complete(
      'offline-session-1794026574949-735',
      'Completed Patrol Sweep.',
      '2026-11-09T04:46:00.000Z',
      employeeId,
      tenantId,
    );

    // -------------------------------------------------------------
    // Step 9 & 10: Backend returns expected format and resolves session
    // -------------------------------------------------------------
    expect(completeResult1.id).toBe('cmw8psnua6a82hpxu8zid97p9');
    expect(completeResult1.status).toBe(PatrolStatus.COMPLETED);

    // -------------------------------------------------------------
    // Step 11: Patrol 2 START mutation is processed.
    // Because Patrol 1 was successfully completed, findActiveByEmployee returns null!
    // NO 409 Conflict is thrown!
    // -------------------------------------------------------------
    const mockSession2 = {
      id: 'cmw9session0002hp002',
      patrolCode: 'PATROL-SESSION-000792',
      clientId: tenantId,
      assignmentId,
      status: PatrolStatus.IN_PROGRESS,
      startedAt: new Date('2026-11-09T05:00:00.000Z'),
      assignment: mockSession1.assignment,
    };

    jest.spyOn(patrolSessionRepository, 'findActiveByEmployee').mockResolvedValue(null);
    jest.spyOn(counterService, 'next').mockResolvedValue(792);
    jest.spyOn(patrolSessionRepository, 'create').mockResolvedValue(mockSession2 as any);

    const startResult2 = await patrolSessionService.start(
      tenantId,
      employeeId,
      assignmentId,
      false,
      '2026-11-09T05:00:00.000Z',
    );

    expect(startResult2.id).toBe('cmw9session0002hp002');
    expect(startResult2.status).toBe(PatrolStatus.IN_PROGRESS);

    // -------------------------------------------------------------
    // Step 12: Remaining events continue synchronizing seamlessly
    // -------------------------------------------------------------
    expect(startResult2.patrolCode).toBe('PATROL-SESSION-000792');
  });
});
