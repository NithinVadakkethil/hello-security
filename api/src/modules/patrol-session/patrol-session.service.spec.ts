import { FaceEnrollmentStatus, PatrolStatus } from '@prisma/client';
import { patrolSessionRepository } from './patrol-session.repository';
import { patrolSessionService } from './patrol-session.service';
import { prisma } from '../../database/prisma';
import { generatePatrolFaceToken } from '../../common/auth/patrol-face-token';

describe('PatrolSession Lifecycle & Cancellation Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('patrolSessionRepository.cancel', () => {
    it('should update status to CANCELLED and set endedAt timestamp without physical deletion when items exist', async () => {
      const mockSession = {
        id: 'session-123',
        status: PatrolStatus.IN_PROGRESS,
        checkpoints: [{ id: 'cp-1' }],
        incidents: [],
        snags: [],
      };
      jest.spyOn(prisma.patrolSession, 'findUnique').mockResolvedValue(mockSession as any);
      const updateSpy = jest.spyOn(prisma.patrolSession, 'update').mockResolvedValue({
        ...mockSession,
        status: PatrolStatus.CANCELLED,
        endedAt: new Date(),
      } as any);

      const result = await patrolSessionRepository.cancel('session-123');

      expect(prisma.patrolSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        include: {
          checkpoints: { select: { id: true } },
          incidents: { select: { id: true } },
          snags: { select: { id: true } },
        },
      });
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: expect.objectContaining({
          status: PatrolStatus.CANCELLED,
          endedAt: expect.any(Date),
        }),
      });
      expect(result).toEqual(expect.objectContaining({ status: PatrolStatus.CANCELLED }));
    });

    it('should handle idempotency gracefully if session is already cancelled', async () => {
      const mockSession = {
        id: 'session-already-cancelled',
        status: PatrolStatus.CANCELLED,
        checkpoints: [{ id: 'cp-1' }],
        incidents: [],
        snags: [],
      };
      jest.spyOn(prisma.patrolSession, 'findUnique').mockResolvedValue(mockSession as any);

      const result = await patrolSessionRepository.cancel('session-already-cancelled');

      expect(result).toEqual({
        success: true,
        message: 'Patrol session is already cancelled.',
      });
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

  describe('patrolSessionService.start & Face Verification', () => {
    it('should reject start if employee has not registered their face', async () => {
      jest.spyOn(prisma.faceEnrollment, 'findUnique').mockResolvedValue(null);

      await expect(
        patrolSessionService.start('client-1', 'emp-1', undefined, false, undefined, undefined),
      ).rejects.toThrow('Employee must register their face before starting a patrol sweep.');
    });

    it('should reject start if faceAuthToken is missing', async () => {
      jest.spyOn(prisma.faceEnrollment, 'findUnique').mockResolvedValue({
        status: FaceEnrollmentStatus.REGISTERED,
      } as any);
      const mockAssignment = { id: 'assignment-1', employeeId: 'emp-1', isActive: true };
      const { assignmentRepository } = require('../assignment/assignment.repository');
      jest.spyOn(assignmentRepository, 'findById').mockResolvedValue(mockAssignment as any);

      await expect(
        patrolSessionService.start('client-1', 'emp-1', 'assignment-1', false, undefined, undefined),
      ).rejects.toThrow('Biometric face verification token is required to start a patrol.');
    });

    it('should reject start if faceAuthToken is forged or bound to another employee', async () => {
      jest.spyOn(prisma.faceEnrollment, 'findUnique').mockResolvedValue({
        status: FaceEnrollmentStatus.REGISTERED,
      } as any);
      const mockAssignment = { id: 'assignment-1', employeeId: 'emp-1', isActive: true };
      const { assignmentRepository } = require('../assignment/assignment.repository');
      jest.spyOn(assignmentRepository, 'findById').mockResolvedValue(mockAssignment as any);

      const forgedToken = generatePatrolFaceToken('other-emp', 'assignment-1');

      await expect(
        patrolSessionService.start('client-1', 'emp-1', 'assignment-1', false, undefined, forgedToken),
      ).rejects.toThrow('Biometric authorization token does not belong to the authenticated employee.');
    });

    it('should auto-clear abandoned zero-checkpoint session when resolveExistingPatrol is true and create new patrol with valid faceAuthToken', async () => {
      const mockAssignment = { id: 'assignment-1', employeeId: 'emp-1', isActive: true };
      const runningSession = { id: 'session-zero', status: PatrolStatus.IN_PROGRESS };

      jest.spyOn(prisma.faceEnrollment, 'findUnique').mockResolvedValue({
        status: FaceEnrollmentStatus.REGISTERED,
      } as any);
      jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(0);
      jest.spyOn(patrolSessionRepository, 'findActiveByEmployee').mockResolvedValue(runningSession as any);
      const cancelSpy = jest.spyOn(patrolSessionRepository, 'cancel').mockResolvedValue({
        id: 'session-zero',
        status: PatrolStatus.CANCELLED,
      } as any);
      jest.spyOn(patrolSessionRepository, 'create').mockResolvedValue({
        id: 'new-session-789',
        patrolCode: 'PTS-10001',
      } as any);

      const { assignmentRepository } = require('../assignment/assignment.repository');
      jest.spyOn(assignmentRepository, 'findById').mockResolvedValue(mockAssignment as any);

      const { counterService } = require('../../common/counter/counter.service');
      jest.spyOn(counterService, 'next').mockResolvedValue(10001);

      const validToken = generatePatrolFaceToken('emp-1', 'assignment-1');

      const result = await patrolSessionService.start('client-1', 'emp-1', 'assignment-1', true, undefined, validToken);

      expect(cancelSpy).toHaveBeenCalledWith('session-zero');
      expect(patrolSessionRepository.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'new-session-789', patrolCode: 'PTS-10001' });

      // Replaying the exact same token should now be rejected as consumed
      await expect(
        patrolSessionService.start('client-1', 'emp-1', 'assignment-1', true, undefined, validToken),
      ).rejects.toThrow('Biometric authorization token has already been consumed (replay detected).');
    });

    it('should throw CONFLICT error if running session exists and resolveExistingPatrol is false', async () => {
      const mockAssignment = { id: 'assignment-1', employeeId: 'emp-1', isActive: true };
      const runningSession = { id: 'session-scanned', status: PatrolStatus.IN_PROGRESS };

      jest.spyOn(prisma.faceEnrollment, 'findUnique').mockResolvedValue({
        status: FaceEnrollmentStatus.REGISTERED,
      } as any);
      jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(3);
      jest.spyOn(patrolSessionRepository, 'findActiveByEmployee').mockResolvedValue(runningSession as any);

      const { assignmentRepository } = require('../assignment/assignment.repository');
      jest.spyOn(assignmentRepository, 'findById').mockResolvedValue(mockAssignment as any);

      const validToken = generatePatrolFaceToken('emp-1', 'assignment-1');

      await expect(
        patrolSessionService.start('client-1', 'emp-1', 'assignment-1', false, undefined, validToken),
      ).rejects.toThrow('You already have a patrol in progress.');
    });
  });

  describe('patrolSessionService.complete', () => {
    it('should auto-cancel zero-checkpoint patrol session when complete is invoked', async () => {
      const mockSession = { id: 'session-zero-complete', status: PatrolStatus.IN_PROGRESS, startedAt: new Date() };
      jest.spyOn(patrolSessionRepository, 'findById').mockResolvedValue(mockSession as any);
      jest.spyOn(prisma.patrolCheckpoint, 'count').mockResolvedValue(0);
      const cancelSpy = jest.spyOn(patrolSessionRepository, 'cancel').mockResolvedValue({
        id: 'session-zero-complete',
        status: PatrolStatus.CANCELLED,
      } as any);

      const result = await patrolSessionService.complete('session-zero-complete');

      expect(cancelSpy).toHaveBeenCalledWith('session-zero-complete');
      expect(result).toEqual({ id: 'session-zero-complete', status: PatrolStatus.CANCELLED });
    });
  });
});
