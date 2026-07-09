import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { gateRepository } from '../gate/gate.repository';
import { patrolRouteRepository } from '../patrol-route/patrol-route.repository';

import { patrolRouteGateRepository } from './patrol-route-gate.repository';
import {
  CreatePatrolRouteGateDto,
  UpdatePatrolRouteGateDto,
} from './patrol-route-gate.types';

export class PatrolRouteGateService {
  async create(routeId: string, dto: CreatePatrolRouteGateDto) {
    const route = await patrolRouteRepository.findById(routeId);

    if (!route) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Patrol route not found.',
      );
    }

    const gate = await gateRepository.findById(dto.gateId);

    if (!gate) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Gate not found.',
      );
    }

    if (gate.siteId !== route.siteId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Gate does not belong to this site.',
      );
    }

    const existingGate = await patrolRouteGateRepository.findByGate(
      routeId,
      dto.gateId,
    );

    if (existingGate) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'Gate already added to this route.',
      );
    }

    const existingSequence = await patrolRouteGateRepository.findBySequence(
      routeId,
      dto.sequence,
    );

    if (existingSequence) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'Sequence already exists.',
      );
    }

    return patrolRouteGateRepository.create({
      patrolRouteId: routeId,
      gateId: dto.gateId,
      sequence: dto.sequence,
    });
  }

  async list(routeId: string) {
    return patrolRouteGateRepository.list(routeId);
  }

  async update(id: string, dto: UpdatePatrolRouteGateDto) {
    const routeGate = await patrolRouteGateRepository.findById(id);

    if (!routeGate) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Route gate not found.',
      );
    }

    if (dto.sequence && dto.sequence !== routeGate.sequence) {
      const existing = await patrolRouteGateRepository.findBySequence(
        routeGate.patrolRouteId,
        dto.sequence,
      );

      if (existing) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          'Sequence already exists.',
        );
      }
    }

    return patrolRouteGateRepository.update(id, dto);
  }

  async delete(id: string) {
    const routeGate = await patrolRouteGateRepository.findById(id);

    if (!routeGate) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Route gate not found.',
      );
    }

    await patrolRouteGateRepository.delete(id);

    return {
      message: 'Gate removed successfully.',
    };
  }
}

export const patrolRouteGateService = new PatrolRouteGateService();
