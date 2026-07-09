import { PatrolStatus } from '@prisma/client';

import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';

import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';

import { assignmentRepository } from '../assignment/assignment.repository';
import { patrolSessionRepository } from './patrol-session.repository';

export class PatrolSessionService {
  async start(clientId: string, employeeId: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Employee account not found.',
      );
    }

    // Find active assignment
    const assignment =
      await assignmentRepository.findEmployeeActiveAssignment(employeeId);

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
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'Patrol already in progress.',
      );
    }

    // Generate Patrol Code
    const sequence = await counterService.next(ENTITY.PATROL_SESSION);

    const patrolCode = generateCode(PREFIX.PATROL_SESSION, sequence);

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

  async history(clientId: string) {
    return patrolSessionRepository.list(clientId);
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

    if (patrol.status !== PatrolStatus.IN_PROGRESS) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Patrol is not in progress.',
      );
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
}

export const patrolSessionService = new PatrolSessionService();
