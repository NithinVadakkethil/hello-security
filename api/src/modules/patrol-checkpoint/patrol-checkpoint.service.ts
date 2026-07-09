import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { assignmentRepository } from '../assignment/assignment.repository';
import { patrolRouteGateRepository } from '../patrol-route-gate/patrol-route-gate.repository';
import { patrolSessionRepository } from '../patrol-session/patrol-session.repository';

import { patrolCheckpointRepository } from './patrol-checkpoint.repository';
import { ScanCheckpointDto } from './patrol-checkpoint.types';

export class PatrolCheckpointService {
  async scan(employeeId: string, dto: ScanCheckpointDto) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Employee account not found.',
      );
    }

    // -----------------------------------------
    // Find active assignment
    // -----------------------------------------

    const assignment =
      await assignmentRepository.findEmployeeActiveAssignment(employeeId);

    if (!assignment) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.NOT_FOUND,
        'No active assignment found.',
      );
    }

    // -----------------------------------------
    // Find active patrol
    // -----------------------------------------

    const patrol = await patrolSessionRepository.findActiveByAssignment(
      assignment.id,
    );

    if (!patrol) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.NOT_FOUND,
        'No patrol in progress.',
      );
    }

    // -----------------------------------------
    // Verify gate belongs to patrol route
    // -----------------------------------------

    const routeGate = await patrolRouteGateRepository.findByRouteAndGate(
      assignment.patrolRouteId,
      dto.gateId,
    );

    if (!routeGate) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Gate does not belong to assigned patrol route.',
      );
    }

    // -----------------------------------------
    // Prevent duplicate scan
    // -----------------------------------------

    const existing = await patrolCheckpointRepository.findBySessionAndGate(
      patrol.id,
      dto.gateId,
    );

    if (existing) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'Gate already scanned.',
      );
    }

    // -----------------------------------------
    // Save checkpoint
    // -----------------------------------------

    const checkpoint = await patrolCheckpointRepository.create({
      patrolSessionId: patrol.id,
      gateId: dto.gateId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      remarks: dto.remarks,
    });

    // -----------------------------------------
    // Progress
    // -----------------------------------------

    const completed = await patrolCheckpointRepository.countBySession(
      patrol.id,
    );

    const total = assignment.patrolRoute.routeGates.length;

    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      checkpoint,

      progress: {
        completed,
        total,
        percentage,
        remaining: total - completed,
      },
    };
  }

  async history(sessionId: string) {
    return patrolCheckpointRepository.listBySession(sessionId);
  }
}

export const patrolCheckpointService = new PatrolCheckpointService();
