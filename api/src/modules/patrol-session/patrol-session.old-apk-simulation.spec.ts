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

  test('Auto-resolves prior session when offline start arrives with customStartedAt without 409 conflict', async () => {
    const uncompletedPriorSession = {
      id: 'cmwok54i78c9zhpxlukk08u9b',
      patrolCode: 'PATROL-SESSION-001510',
      clientId: tenantId,
      assignmentId: 'cmuwrb0tp024ehp87g9q45b79', // Basement 4
      status: PatrolStatus.IN_PROGRESS,
      startedAt: new Date('2026-11-20T05:18:53.315Z'),
      endedAt: null,
      assignment: {
        id: 'cmuwrb0tp024ehp87g9q45b79',
        employeeId,
        clientId: tenantId,
        isActive: true,
        patrolRoute: { name: 'Basement 4', isActive: true, routeGates: [{ gate: { isActive: true } }] },
        site: { name: 'Marina 101' },
      },
    };

    const nextAssignment = {
      id: 'cmuwrb0tc024chp8780s9kg40', // Basement 3
      employeeId,
      clientId: tenantId,
      isActive: true,
      patrolRoute: { name: 'Basement 3', isActive: true, routeGates: [{ gate: { isActive: true } }] },
      site: { name: 'Marina 101' },
    };

    const nextSession = {
      id: 'cmwok50bq8c6hhpxlrvxsr6dz',
      patrolCode: 'PATROL-SESSION-001511',
      clientId: tenantId,
      assignmentId: nextAssignment.id,
      status: PatrolStatus.IN_PROGRESS,
      startedAt: new Date('2026-11-20T05:22:00.000Z'),
      assignment: nextAssignment,
    };

    // Prior session is still IN_PROGRESS in findActiveByEmployee
    jest.spyOn(patrolSessionRepository, 'findActiveByEmployee').mockResolvedValue(uncompletedPriorSession as any);
    jest.spyOn(assignmentRepository, 'findById').mockResolvedValue(nextAssignment as any);
    jest.spyOn(prisma.guardAssignment, 'findUnique').mockResolvedValue(nextAssignment as any);
    jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(8);
    jest.spyOn(prisma.patrolCheckpoint, 'findFirst').mockResolvedValue({
      id: 'cp-last',
      completedAt: new Date('2026-11-20T05:21:17.247Z'),
      scannedAt: new Date('2026-11-20T05:21:09.746Z'),
    } as any);

    const updateSpy = jest.spyOn(patrolSessionRepository, 'update').mockResolvedValue({
      ...uncompletedPriorSession,
      status: PatrolStatus.COMPLETED,
      endedAt: new Date('2026-11-20T05:21:17.247Z'),
    } as any);

    jest.spyOn(counterService, 'next').mockResolvedValue(1511);
    jest.spyOn(patrolSessionRepository, 'create').mockResolvedValue(nextSession as any);

    // Guard starts next route offline with customStartedAt and resolveExistingPatrol = false (old APK default)
    const result = await patrolSessionService.start(
      tenantId,
      employeeId,
      nextAssignment.id,
      false, // resolveExistingPatrol is false from distributed APK
      '2026-11-20T05:22:00.000Z',
    );

    // Prior session auto-completed
    expect(updateSpy).toHaveBeenCalledWith(
      uncompletedPriorSession.id,
      expect.objectContaining({
        status: PatrolStatus.COMPLETED,
        remarks: 'Auto-completed upon starting a new patrol session.',
      }),
    );

    // New session started successfully
    expect(result.id).toBe(nextSession.id);
    expect(result.status).toBe(PatrolStatus.IN_PROGRESS);
  });
});
