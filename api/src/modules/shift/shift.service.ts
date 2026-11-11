import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';

import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';

import { shiftRepository } from './shift.repository';

import { CreateShiftDto, UpdateShiftDto } from './shift.types';
import { CurrentUser } from '../../common/auth/current-user';
import { assertTenantAccess } from '../../common/auth/tenant-access';

import { prisma } from '../../database/prisma';

export class ShiftService {
  async create(clientId: string, dto: CreateShiftDto) {
    const existing = await shiftRepository.findByName(clientId, dto.name);

    if (existing) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'Shift already exists.',
      );
    }

    if (dto.startTime === dto.endTime) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Start time and end time cannot be the same.',
      );
    }

    const shiftCount = await prisma.shift.count({ where: { clientId } });
    if (shiftCount === 0) {
      await prisma.counter.upsert({
        where: {
          entity_clientId: {
            entity: ENTITY.SHIFT,
            clientId,
          },
        },
        update: { value: 0 },
        create: {
          entity: ENTITY.SHIFT,
          clientId,
          value: 0,
        },
      });
    }

    let sequence = await counterService.next(ENTITY.SHIFT, clientId);
    let shiftCode = generateCode(PREFIX.SHIFT, sequence);

    let existingShiftCode = await shiftRepository.findByShiftCode(clientId, shiftCode);

    while (existingShiftCode) {
      sequence = await counterService.next(ENTITY.SHIFT, clientId);
      shiftCode = generateCode(PREFIX.SHIFT, sequence);
      existingShiftCode = await shiftRepository.findByShiftCode(clientId, shiftCode);
    }

    return shiftRepository.create({
      clientId,
      shiftCode,
      ...dto,
    });
  }

  async list(clientId?: string, isActive?: boolean, siteId?: string) {
    return shiftRepository.list(clientId, isActive, siteId);
  }

  async get(id: string, user?: CurrentUser) {
    const shift = await shiftRepository.findById(id);

    if (!shift) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Shift not found.',
      );
    }

    await assertTenantAccess(
      user,
      shift.clientId,
      'Access denied. Shift does not belong to your organization.',
    );

    return shift;
  }

  async update(id: string, dto: UpdateShiftDto, user?: CurrentUser) {
    const shift = await this.get(id, user);

    if (dto.name && dto.name !== shift.name) {
      const existing = await shiftRepository.findByName(
        shift.clientId,
        dto.name,
      );

      if (existing) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          'Shift already exists.',
        );
      }
    }

    if (dto.startTime && dto.endTime && dto.startTime === dto.endTime) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Start time and end time cannot be the same.',
      );
    }

    return shiftRepository.update(id, dto);
  }

  async activate(id: string, user?: CurrentUser) {
    await this.get(id, user);

    await shiftRepository.activate(id);

    return {
      message: 'Shift activated successfully.',
    };
  }

  async deactivate(id: string, user?: CurrentUser) {
    await this.get(id, user);

    await shiftRepository.deactivate(id);

    return {
      message: 'Shift deactivated successfully.',
    };
  }
}

export const shiftService = new ShiftService();
