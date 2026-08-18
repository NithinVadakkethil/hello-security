import { PatrolStatus } from '@prisma/client';

import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { prisma } from '../../database/prisma';

import { assignmentRepository } from '../assignment/assignment.repository';
import { patrolSessionRepository } from './patrol-session.repository';
import { ListPatrolSessionsQuery } from './patrol-session.types';

export class PatrolSessionService {
  async start(clientId: string, employeeId: string, targetAssignmentId?: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Employee account not found.',
      );
    }

    let assignment;
    if (targetAssignmentId) {
      assignment = await assignmentRepository.findById(targetAssignmentId);
      if (!assignment || assignment.employeeId !== employeeId || !assignment.isActive) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.NOT_FOUND,
          'Specified active assignment not found for this employee.',
        );
      }
    } else {
      assignment = await assignmentRepository.findEmployeeActiveAssignment(employeeId);
    }

    if (!assignment) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.NOT_FOUND,
        'No active assignment found.',
      );
    }

    // Already running?
    const running = await patrolSessionRepository.findActiveByAssignment(
      assignment.id,
    );

    if (running) {
      const scannedCount = await prisma.patrolCheckpoint.count({
        where: { patrolSessionId: running.id },
      });

      if (scannedCount === 0) {
        // Abandoned zero-checkpoint session — auto-clear it so starting a new patrol succeeds cleanly
        await patrolSessionRepository.cancel(running.id);
      } else {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          'Patrol already in progress.',
        );
      }
    }

    // Generate Patrol Code based on highest existing valid DB record
    const patrolCode = await patrolSessionRepository.getNextPatrolCode(clientId);

    return patrolSessionRepository.create({
      clientId,
      assignmentId: assignment.id,
      patrolCode,
      startedAt: new Date(),
      status: PatrolStatus.IN_PROGRESS,
    });
  }

  async current(employeeId: string) {
    const assignment =
      await assignmentRepository.findEmployeeActiveAssignment(employeeId);

    if (!assignment) {
      return null;
    }

    return patrolSessionRepository.findActiveByAssignment(assignment.id);
  }

  async history(clientId: string, query?: ListPatrolSessionsQuery) {
    return patrolSessionRepository.list(clientId, query);
  }

  async pause(id: string) {
    const patrol = await patrolSessionRepository.findById(id);

    if (!patrol) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Patrol not found.',
      );
    }

    if (patrol.status !== PatrolStatus.IN_PROGRESS) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Patrol is not in progress.',
      );
    }

    return patrolSessionRepository.update(id, {
      status: PatrolStatus.PAUSED,
      pauseCount: patrol.pauseCount + 1,
    });
  }

  async resume(id: string) {
    const patrol = await patrolSessionRepository.findById(id);

    if (!patrol) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Patrol not found.',
      );
    }

    if (patrol.status !== PatrolStatus.PAUSED) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Patrol is not paused.',
      );
    }

    return patrolSessionRepository.update(id, {
      status: PatrolStatus.IN_PROGRESS,
    });
  }

  async complete(id: string, remarks?: string) {
    const patrol = await patrolSessionRepository.findById(id);

    if (!patrol) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Patrol not found.',
      );
    }

    if (patrol.status !== PatrolStatus.IN_PROGRESS && patrol.status !== PatrolStatus.PAUSED) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Patrol is not in progress.',
      );
    }

    const checkpointCount = await prisma.patrolCheckpoint.count({
      where: { patrolSessionId: id },
    });

    if (checkpointCount === 0) {
      return patrolSessionRepository.cancel(id);
    }

    const endedAt = new Date();

    const totalDuration = Math.floor(
      (endedAt.getTime() - patrol.startedAt.getTime()) / 60000,
    );

    return patrolSessionRepository.update(id, {
      status: PatrolStatus.COMPLETED,
      endedAt,
      totalDuration,
      remarks,
    });
  }

  async cancel(id: string) {
    return patrolSessionRepository.cancel(id);
  }

  async findById(id: string) {
    return patrolSessionRepository.findFullById(id);
  }

  async verify(
    id: string,
    userId: string,
    dto: {
      verificationStatus: 'VERIFIED' | 'NOT_VERIFIED';
      supervisorRemarks?: string;
    },
  ) {
    const patrol = await patrolSessionRepository.findById(id);

    if (!patrol) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Patrol session not found.',
      );
    }

    if (
      dto.verificationStatus !== 'VERIFIED' &&
      dto.verificationStatus !== 'NOT_VERIFIED'
    ) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Invalid verification status. Must be VERIFIED or NOT_VERIFIED.',
      );
    }

    return patrolSessionRepository.verifyPatrolSession(id, {
      verificationStatus: dto.verificationStatus,
      verifiedById: userId,
      verificationTime: new Date(),
      supervisorRemarks: dto.supervisorRemarks,
    });
  }
}

export const patrolSessionService = new PatrolSessionService();
