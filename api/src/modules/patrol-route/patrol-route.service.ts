import { Prisma } from '@prisma/client';

import { prisma } from '../../database/prisma';

import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';

import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';

import { gateRepository } from '../gate/gate.repository';
import { siteRepository } from '../site/site.repository';
import { patrolRouteRepository } from './patrol-route.repository';

import {
  CreatePatrolRouteDto,
  UpdatePatrolRouteDto,
} from './patrol-route.types';

export class PatrolRouteService {
  async create(clientId: string, dto: CreatePatrolRouteDto) {
    const site = await siteRepository.findById(dto.siteId);

    if (!site || site.clientId !== clientId) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Site not found.',
      );
    }

    if (!site.isActive) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Site is inactive.',
      );
    }

    const existing = await patrolRouteRepository.findByName(
      dto.siteId,
      dto.name,
    );

    if (existing) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'Route name already exists.',
      );
    }

    // Duplicate sequence
    const sequences = dto.checkpoints.map((c) => c.sequence);

    if (new Set(sequences).size !== sequences.length) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Duplicate sequence found.',
      );
    }

    // Duplicate gate
    const gates = dto.checkpoints.map((c) => c.gateId);

    if (new Set(gates).size !== gates.length) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Duplicate gate found.',
      );
    }

    // Validate gates
    for (const checkpoint of dto.checkpoints) {
      const gate = await gateRepository.findById(checkpoint.gateId);

      if (!gate) {
        throw new AppError(
          HttpStatus.NOT_FOUND,
          ErrorCodes.NOT_FOUND,
          'Gate not found.',
        );
      }

      if (gate.siteId !== dto.siteId) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'Gate belongs to another site.',
        );
      }

      if (!gate.isActive) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'One or more selected checkpoints are inactive and cannot be added to a patrol route.',
        );
      }
    }

    const routeCount = await prisma.patrolRoute.count({ where: { clientId } });
    if (routeCount === 0) {
      await prisma.counter.upsert({
        where: {
          entity_clientId: {
            entity: ENTITY.PATROL,
            clientId,
          },
        },
        update: { value: 0 },
        create: {
          entity: ENTITY.PATROL,
          clientId,
          value: 0,
        },
      });
    }

    let sequence = await counterService.next(ENTITY.PATROL, clientId);
    let routeCode = generateCode(PREFIX.PATROL, sequence);

    let existingRouteCode = await prisma.patrolRoute.findFirst({ where: { clientId, routeCode } });

    while (existingRouteCode) {
      sequence = await counterService.next(ENTITY.PATROL, clientId);
      routeCode = generateCode(PREFIX.PATROL, sequence);
      existingRouteCode = await prisma.patrolRoute.findFirst({ where: { clientId, routeCode } });
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const route = await tx.patrolRoute.create({
        data: {
          clientId,
          siteId: dto.siteId,
          routeCode,
          name: dto.name,
          description: dto.description,
        },
      });

      await tx.patrolRouteGate.createMany({
        data: dto.checkpoints.map((cp) => ({
          patrolRouteId: route.id,
          gateId: cp.gateId,
          sequence: cp.sequence,
          expectedDuration: cp.expectedDuration,
        })),
      });

      return tx.patrolRoute.findUnique({
        where: {
          id: route.id,
        },
        include: {
          site: true,
          routeGates: {
            include: {
              gate: true,
            },
            orderBy: {
              sequence: 'asc',
            },
          },
        },
      });
    });
  }

  async list(clientId: string, isActive?: boolean) {
    return patrolRouteRepository.list(clientId, isActive);
  }

  async get(id: string) {
    const route = await patrolRouteRepository.findById(id);

    if (!route) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Route not found.',
      );
    }

    return route;
  }

  async update(id: string, dto: UpdatePatrolRouteDto) {
    const route = await this.get(id);

    if (dto.name && dto.name !== route.name) {
      const existing = await patrolRouteRepository.findByName(
        route.siteId,
        dto.name,
      );
      if (existing && existing.id !== id) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          "Route name already exists for this site.",
        );
      }
    }

    if (dto.checkpoints) {
      if (dto.checkpoints.length === 0) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'A patrol route must contain at least one checkpoint.',
        );
      }

      const sequences = dto.checkpoints.map((c) => c.sequence);
      if (new Set(sequences).size !== sequences.length) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          "Duplicate sequence found.",
        );
      }

      const gates = dto.checkpoints.map((c) => c.gateId);
      if (new Set(gates).size !== gates.length) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          "Duplicate gate found.",
        );
      }

      for (const cp of dto.checkpoints) {
        const gate = await gateRepository.findById(cp.gateId);
        if (!gate) {
          throw new AppError(
            HttpStatus.NOT_FOUND,
            ErrorCodes.NOT_FOUND,
            "Gate not found.",
          );
        }
        if (gate.siteId !== route.siteId) {
          throw new AppError(
            HttpStatus.BAD_REQUEST,
            ErrorCodes.VALIDATION_ERROR,
            `Gate "${gate.name}" belongs to another site.`,
          );
        }
        if (!gate.isActive) {
          throw new AppError(
            HttpStatus.BAD_REQUEST,
            ErrorCodes.VALIDATION_ERROR,
            `Gate "${gate.name}" is inactive.`,
          );
        }
      }
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updateData: Prisma.PatrolRouteUpdateInput = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      await tx.patrolRoute.update({
        where: { id },
        data: updateData,
      });

      if (dto.checkpoints) {
        await tx.patrolRouteGate.deleteMany({
          where: { patrolRouteId: id },
        });

        if (dto.checkpoints.length > 0) {
          await tx.patrolRouteGate.createMany({
            data: dto.checkpoints.map((cp, idx) => ({
              patrolRouteId: id,
              gateId: cp.gateId,
              sequence: idx + 1,
              expectedDuration: cp.expectedDuration ?? 5,
            })),
          });
        }
      }

      return tx.patrolRoute.findUnique({
        where: { id },
        include: {
          site: true,
          routeGates: {
            include: {
              gate: true,
            },
            orderBy: {
              sequence: "asc",
            },
          },
        },
      });
    });
  }

  async activate(id: string) {
    await this.get(id);

    await patrolRouteRepository.activate(id);

    return {
      message: 'Route activated successfully.',
    };
  }

  async deactivate(id: string) {
    await this.get(id);

    await patrolRouteRepository.deactivate(id);

    return {
      message: 'Route deactivated successfully.',
    };
  }
}

export const patrolRouteService = new PatrolRouteService();
