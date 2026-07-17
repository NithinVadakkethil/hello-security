import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';

import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';

import { shiftRepository } from './shift.repository';

import { CreateShiftDto, UpdateShiftDto } from './shift.types';

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

    const sequence = await counterService.next(ENTITY.SHIFT, clientId);

    const shiftCode = generateCode(PREFIX.SHIFT, sequence);

    return shiftRepository.create({
      clientId,
      shiftCode,
      ...dto,
    });
  }

  async list(clientId: string, isActive?: boolean) {
    return shiftRepository.list(clientId, isActive);
  }

  async get(id: string) {
    const shift = await shiftRepository.findById(id);

    if (!shift) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Shift not found.',
      );
    }

    return shift;
  }

  async update(id: string, dto: UpdateShiftDto) {
    const shift = await this.get(id);

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

  async activate(id: string) {
    await this.get(id);

    await shiftRepository.activate(id);

    return {
      message: 'Shift activated successfully.',
    };
  }

  async deactivate(id: string) {
    await this.get(id);

    await shiftRepository.deactivate(id);

    return {
      message: 'Shift deactivated successfully.',
    };
  }
}

export const shiftService = new ShiftService();
