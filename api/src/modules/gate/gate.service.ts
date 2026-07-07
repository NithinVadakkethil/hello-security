import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';

import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';

import { siteRepository } from '../site/site.repository';
import { gateRepository } from './gate.repository';

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

    const sequence = await counterService.next(ENTITY.GATE);

    const gateCode = generateCode(PREFIX.GATE, sequence);

    return gateRepository.create({
      ...dto,
      gateCode,
    });
  }

  async list(siteId: string, isActive?: boolean) {
    return gateRepository.list(siteId, isActive);
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
}

export const gateService = new GateService();
