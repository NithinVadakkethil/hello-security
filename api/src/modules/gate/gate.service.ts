import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';

import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';

import { siteRepository } from '../site/site.repository';
import { gateRepository } from './gate.repository';
import { prisma } from '../../database/prisma';

import { CreateGateDto, UpdateGateDto } from './gate.types';

export class GateService {
  async create(dto: CreateGateDto) {
    const site = await siteRepository.findById(dto.siteId);

    if (!site) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Site not found.',
      );
    }

    // Validate Checkpoint Creation Limit
    const client = await prisma.client.findUnique({
      where: { id: site.clientId },
      select: { maxCheckpoints: true },
    });

    if (client && client.maxCheckpoints !== null && client.maxCheckpoints !== undefined) {
      const currentGateCount = await prisma.gate.count({
        where: {
          site: {
            clientId: site.clientId,
          },
        },
      });

      if (currentGateCount >= client.maxCheckpoints) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          `Checkpoint creation limit reached. Maximum allowed: ${client.maxCheckpoints}. Current count: ${currentGateCount}.`,
        );
      }
    }

    const existingGate = await gateRepository.findByName(dto.siteId, dto.name);

    if (existingGate) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'Gate name already exists.',
      );
    }

    const existingSequence = await gateRepository.findBySequence(
      dto.siteId,
      dto.sequence,
    );

    if (existingSequence) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'Sequence already exists.',
      );
    }

    const gateCount = await prisma.gate.count({
      where: { siteId: dto.siteId },
    });

    if (gateCount === 0) {
      await prisma.counter.upsert({
        where: {
          entity_clientId: {
            entity: ENTITY.GATE,
            clientId: dto.siteId,
          },
        },
        update: { value: 0 },
        create: {
          entity: ENTITY.GATE,
          clientId: dto.siteId,
          value: 0,
        },
      });
    }

    let sequence = await counterService.next(ENTITY.GATE, dto.siteId);
    let gateCode = generateCode(PREFIX.GATE, sequence);

    let existingCode = await gateRepository.findByUniqueCode(dto.siteId, gateCode);

    while (existingCode) {
      sequence = await counterService.next(ENTITY.GATE, dto.siteId);
      gateCode = generateCode(PREFIX.GATE, sequence);
      existingCode = await gateRepository.findByUniqueCode(dto.siteId, gateCode);
    }

    return gateRepository.create({
      ...dto,
      gateCode,
    });
  }

  async list(siteId?: string, isActive?: boolean, clientId?: string) {
    return gateRepository.list(siteId, isActive, clientId);
  }

  async get(id: string) {
    const gate = await gateRepository.findById(id);

    if (!gate) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Gate not found.',
      );
    }

    return gate;
  }

  async update(id: string, dto: UpdateGateDto) {
    const gate = await this.get(id);

    if (dto.name && dto.name !== gate.name) {
      const existing = await gateRepository.findByName(gate.siteId, dto.name);

      if (existing) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          'Gate name already exists.',
        );
      }
    }

    if (dto.sequence && dto.sequence !== gate.sequence) {
      const existing = await gateRepository.findBySequence(
        gate.siteId,
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

    return gateRepository.update(id, dto);
  }

  async activate(id: string) {
    await this.get(id);

    await gateRepository.activate(id);

    return {
      message: 'Gate activated successfully.',
    };
  }

  async deactivate(id: string) {
    await this.get(id);

    await gateRepository.deactivate(id);

    return {
      message: 'Gate deactivated successfully.',
    };
  }

  async delete(id: string) {
    await this.get(id);

    const activeSubTasksCount = await prisma.gateSubTask.count({
      where: {
        gateId: id,
        isActive: true,
      },
    });

    if (activeSubTasksCount > 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        `Cannot delete gate while ${activeSubTasksCount} active sub-task(s) exist. Please delete or deactivate the sub-tasks first.`,
      );
    }

    return gateRepository.delete(id);
  }
}

export const gateService = new GateService();
