import { PatrolStatus } from '@prisma/client';
import { patrolSessionRepository } from './patrol-session.repository';
import { patrolSessionService } from './patrol-session.service';
import { prisma } from '../../database/prisma';

describe('PatrolSession Lifecycle & Cancellation Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('patrolSessionRepository.cancel', () => {
    it('should decouple linked snags/incidents and delete session when scannedCheckpointCount is 0', async () => {
      const mockSession = { id: 'session-123', status: PatrolStatus.IN_PROGRESS };
      jest.spyOn(prisma.patrolSession, 'findUnique').mockResolvedValue(mockSession as any);
      jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(0);

      const transactionSpy = jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        const txMock = {
          snag: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          incident: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          patrolCheckpoint: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          patrolSession: { delete: jest.fn().mockResolvedValue(mockSession) },
        };
        return cb(txMock);
      });

      const result = await patrolSessionRepository.cancel('session-123');

      expect(prisma.patrolSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        select: { id: true, status: true },
      });
      expect(prisma.patrolCheckpoint.count).toHaveBeenCalledWith({
        where: { patrolSessionId: 'session-123' },
      });
      expect(transactionSpy).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Unscanned patrol session deleted.',
      });
    });

    it('should update status to CANCELLED when scannedCheckpointCount is > 0', async () => {
      const mockSession = { id: 'session-456', status: PatrolStatus.IN_PROGRESS };
      jest.spyOn(prisma.patrolSession, 'findUnique').mockResolvedValue(mockSession as any);
      jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(2);
      const updateSpy = jest.spyOn(prisma.patrolSession, 'update').mockResolvedValue({
        ...mockSession,
        status: PatrolStatus.CANCELLED,
      } as any);

      const result = await patrolSessionRepository.cancel('session-456');

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'session-456' },
        data: expect.objectContaining({
          status: PatrolStatus.CANCELLED,
        }),
      });
      expect(result).toEqual(expect.objectContaining({ status: PatrolStatus.CANCELLED }));
    });

    it('should handle idempotency gracefully if session does not exist', async () => {
      jest.spyOn(prisma.patrolSession, 'findUnique').mockResolvedValue(null);

      const result = await patrolSessionRepository.cancel('non-existent-id');

      expect(result).toEqual({
        success: true,
        message: 'Patrol session already cleared or cancelled.',
      });
    });
  });

  describe('patrolSessionService.start', () => {
    it('should auto-clear abandoned zero-checkpoint session and create new patrol', async () => {
      const mockAssignment = { id: 'assignment-1', employeeId: 'emp-1', isActive: true };
      const runningSession = { id: 'session-zero', status: PatrolStatus.IN_PROGRESS };

      jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(0);
      jest.spyOn(patrolSessionRepository, 'findActiveByAssignment').mockResolvedValue(runningSession as any);
      const cancelSpy = jest.spyOn(patrolSessionRepository, 'cancel').mockResolvedValue({
        success: true,
        message: 'Unscanned patrol session deleted.',
      });
      jest.spyOn(patrolSessionRepository, 'create').mockResolvedValue({
        id: 'new-session-789',
        patrolCode: 'PTS-10001',
      } as any);

      const { assignmentRepository } = require('../assignment/assignment.repository');
      jest.spyOn(assignmentRepository, 'findEmployeeActiveAssignment').mockResolvedValue(mockAssignment as any);

      const { counterService } = require('../../common/counter/counter.service');
      jest.spyOn(counterService, 'next').mockResolvedValue(10001);

      const result = await patrolSessionService.start('client-1', 'emp-1');

      expect(cancelSpy).toHaveBeenCalledWith('session-zero');
      expect(patrolSessionRepository.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'new-session-789', patrolCode: 'PTS-10001' });
    });

    it('should throw CONFLICT error if running session has scanned checkpoints', async () => {
      const mockAssignment = { id: 'assignment-1', employeeId: 'emp-1', isActive: true };
      const runningSession = { id: 'session-scanned', status: PatrolStatus.IN_PROGRESS };

      jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(3);
      jest.spyOn(patrolSessionRepository, 'findActiveByAssignment').mockResolvedValue(runningSession as any);

      const { assignmentRepository } = require('../assignment/assignment.repository');
      jest.spyOn(assignmentRepository, 'findEmployeeActiveAssignment').mockResolvedValue(mockAssignment as any);

      await expect(patrolSessionService.start('client-1', 'emp-1')).rejects.toThrow('Patrol already in progress.');
    });
  });

  describe('patrolSessionService.complete', () => {
    it('should auto-cancel zero-checkpoint patrol session when complete is invoked', async () => {
      const mockSession = { id: 'session-zero-complete', status: PatrolStatus.IN_PROGRESS, startedAt: new Date() };
      jest.spyOn(patrolSessionRepository, 'findById').mockResolvedValue(mockSession as any);
      jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(0);
      const cancelSpy = jest.spyOn(patrolSessionRepository, 'cancel').mockResolvedValue({
        success: true,
        message: 'Unscanned patrol session deleted.',
      } as any);

      const result = await patrolSessionService.complete('session-zero-complete');

      expect(cancelSpy).toHaveBeenCalledWith('session-zero-complete');
      expect(result).toEqual({ success: true, message: 'Unscanned patrol session deleted.' });
    });
  });
});
