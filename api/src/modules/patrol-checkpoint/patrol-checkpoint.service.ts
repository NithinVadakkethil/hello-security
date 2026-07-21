import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

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
    // Find active patrol session for employee
    // -----------------------------------------

    const patrol = await patrolSessionRepository.findActiveByEmployee(employeeId);

    if (!patrol) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.NOT_FOUND,
        'No patrol in progress.',
      );
    }

    const assignment = patrol.assignment as any;

    // -----------------------------------------
    // Verify gate belongs to patrol route or direct assignment
    // -----------------------------------------

    let isGateValid = false;

    if (assignment.patrolRouteId) {
      const routeGate = await patrolRouteGateRepository.findByRouteAndGate(
        assignment.patrolRouteId,
        dto.gateId,
      );
      if (routeGate) {
        isGateValid = true;
      }
    } else if (assignment.assignmentGates && assignment.assignmentGates.length > 0) {
      isGateValid = assignment.assignmentGates.some((ag: any) => ag.gateId === dto.gateId);
    }

    if (!isGateValid) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Gate does not belong to assigned patrol task.',
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
      status: dto.status,
      images: dto.images,
    });

    // -----------------------------------------
    // Progress
    // -----------------------------------------

    const completed = await patrolCheckpointRepository.countBySession(
      patrol.id,
    );

    const total = assignment.patrolRoute
      ? assignment.patrolRoute.routeGates.length
      : assignment.assignmentGates
      ? assignment.assignmentGates.length
      : 0;

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
