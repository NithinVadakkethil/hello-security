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
import { CurrentUser } from '../../common/auth/current-user';
import { assertTenantAccess } from '../../common/auth/tenant-access';

export class GateService {
  async create(dto: CreateGateDto, user?: CurrentUser) {
    const site = await siteRepository.findById(dto.siteId);

    if (!site) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Site not found.',
      );
    }

    await assertTenantAccess(
      user,
      site.clientId,
      'Access denied. Site does not belong to your organization.',
    );

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

    if (!dto.sequence || Number(dto.sequence) <= 0) {
      dto.sequence = await gateRepository.getNextSequence(dto.siteId);
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

  async list(
    siteId?: string,
    isActive?: boolean,
    clientId?: string,
    page?: number,
    limit?: number,
    search?: string,
    floor?: string,
  ) {
    return gateRepository.list(siteId, isActive, clientId, page, limit, search, floor);
  }

  async getFloors(siteId: string, userTenantId?: string, user?: CurrentUser) {
    const site = await siteRepository.findById(siteId);

    if (!site) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Site not found.',
      );
    }

    if (user) {
      await assertTenantAccess(user, site.clientId, 'Access to site floors denied.');
    } else if (userTenantId && site.clientId !== userTenantId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Access to site floors denied.',
      );
    }

    return gateRepository.getFloors(siteId, user ? undefined : userTenantId);
  }

  async getNextSequence(siteId: string, user?: CurrentUser) {
    if (user) {
      const site = await siteRepository.findById(siteId);
      if (!site) {
        throw new AppError(
          HttpStatus.NOT_FOUND,
          ErrorCodes.NOT_FOUND,
          'Site not found.',
        );
      }
      await assertTenantAccess(
        user,
        site.clientId,
        'Access denied. Site does not belong to your organization.',
      );
    }

    const nextSequence = await gateRepository.getNextSequence(siteId);
    return { nextSequence };
  }

  async get(id: string, user?: CurrentUser) {
    const gate = await gateRepository.findById(id);

    if (!gate) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Gate not found.',
      );
    }

    if (user) {
      const siteClientId =
        (gate as any).site?.clientId ||
        (await siteRepository.findById(gate.siteId))?.clientId;
      await assertTenantAccess(
        user,
        siteClientId,
        'Access denied. Checkpoint does not belong to your organization.',
      );
    }

    return gate;
  }

  async update(id: string, dto: UpdateGateDto, user?: CurrentUser) {
    const gate = await this.get(id, user);

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

  async activate(id: string, user?: CurrentUser) {
    await this.get(id, user);

    await gateRepository.activate(id);

    return {
      message: 'Gate activated successfully.',
    };
  }

  async deactivate(id: string, user?: CurrentUser) {
    await this.get(id, user);

    await gateRepository.deactivate(id);

    return {
      message: 'Gate deactivated successfully.',
    };
  }

  async delete(id: string, user?: CurrentUser) {
    const gate = await this.get(id, user);

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

    return prisma.$transaction(async (tx) => {
      const result = await gateRepository.delete(id, tx);

      // Compact sequence numbers for remaining checkpoints on the site
      await tx.gate.updateMany({
        where: {
          siteId: gate.siteId,
          sequence: { gt: gate.sequence },
        },
        data: {
          sequence: { decrement: 1 },
        },
      });

      return result;
    });
  }

  async getBulkRange(
    siteId: string,
    fromSeq?: number,
    toSeq?: number,
    userTenantId?: string,
    user?: CurrentUser,
  ) {
    const site = await siteRepository.findById(siteId);

    if (!site) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Site not found.',
      );
    }

    if (user) {
      await assertTenantAccess(user, site.clientId, 'Access to site checkpoints denied.');
    } else if (userTenantId && site.clientId !== userTenantId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Access to site checkpoints denied.',
      );
    }

    const result = await gateRepository.listBySequenceRange(siteId, fromSeq, toSeq, user ? undefined : userTenantId);

    return {
      site: {
        id: site.id,
        name: site.name,
        siteCode: site.siteCode,
      },
      totalSiteCount: result.totalSiteCount,
      fromSeq,
      toSeq,
      count: result.items.length,
      items: result.items,
    };
  }
}

export const gateService = new GateService();
