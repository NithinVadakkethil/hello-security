import { PatrolStatus } from '@prisma/client';

import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { logger } from '../../common/logger/logger';
import { notificationQueueService } from '../../common/queue/notification-queue.service';
import { prisma } from '../../database/prisma';

import { assignmentRepository } from '../assignment/assignment.repository';
import { patrolSessionRepository } from './patrol-session.repository';
import { ListPatrolSessionsQuery } from './patrol-session.types';

export class PatrolSessionService {
  async start(
    clientId: string,
    employeeId: string,
    targetAssignmentId?: string,
    resolveExistingPatrol?: boolean,
  ) {
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

    // Single active patrol rule: Check for ANY active session for this employee
    const running = await patrolSessionRepository.findActiveByEmployee(employeeId);

    if (running) {
      const scannedCount = await prisma.patrolCheckpoint.count({
        where: { patrolSessionId: running.id },
      });

      if (!resolveExistingPatrol) {
        // Return structured conflict error payload (whether 0 scans or >0 scans)
        throw new AppError(
          HttpStatus.CONFLICT,
          'ACTIVE_PATROL_EXISTS',
          'You already have a patrol in progress.',
          {
            activePatrolSessionId: running.id,
            patrolCode: running.patrolCode,
            routeName: running.assignment?.patrolRoute?.name || 'Direct Checkpoints',
            siteName: running.assignment?.site?.name || 'Monitored Site',
            scannedCheckpointCount: scannedCount,
          },
        );
      } else {
        // User confirmed resolution (resolveExistingPatrol: true)
        if (scannedCount >= 1) {
          const endedAt = new Date();
          const totalDuration = Math.floor(
            (endedAt.getTime() - running.startedAt.getTime()) / 60000,
          );
          await patrolSessionRepository.update(running.id, {
            status: PatrolStatus.COMPLETED,
            endedAt,
            totalDuration,
            remarks: 'Auto-completed upon starting a new patrol session.',
          });

          // Enqueue completed patrol email notification asynchronously
          notificationQueueService
            .enqueueCompletedPatrol(running.id, running.clientId)
            .catch((err) => {
              logger.error(
                `Failed to enqueue completed patrol notification for session ${running.id}: ${err.message}`,
              );
            });
        } else {
          // Cancel/discard abandoned 0-scan patrol session
          await patrolSessionRepository.cancel(running.id);
        }
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
      if (patrol.status === PatrolStatus.COMPLETED) {
        return patrol;
      }
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

    const completedPatrol = await patrolSessionRepository.update(id, {
      status: PatrolStatus.COMPLETED,
      endedAt,
      totalDuration,
      remarks,
    });

    // Asynchronously queue completed patrol email notification (non-blocking)
    notificationQueueService
      .enqueueCompletedPatrol(id, patrol.clientId)
      .catch((err) => {
        logger.error(
          `Failed to enqueue completed patrol notification for session ${id}: ${err.message}`,
        );
      });

    return completedPatrol;
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

    const updateData: any = {
      verificationStatus: dto.verificationStatus,
      verifiedById: userId,
      verificationTime: new Date(),
      supervisorRemarks: dto.supervisorRemarks,
    };

    if (patrol.status === PatrolStatus.IN_PROGRESS || patrol.status === PatrolStatus.PAUSED) {
      updateData.status = PatrolStatus.COMPLETED;
      updateData.endedAt = patrol.endedAt || new Date();
      updateData.remarks = patrol.remarks || 'Completed & verified by supervisor.';
    }

    return patrolSessionRepository.verifyPatrolSession(id, updateData);
  }
}

export const patrolSessionService = new PatrolSessionService();
