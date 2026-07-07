import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';
import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';

import { siteRepository } from './site.repository';
import { CreateSiteDto, UpdateSiteDto } from './site.types';

export class SiteService {
  async create(clientId: string, dto: CreateSiteDto) {
    const existingSite = await siteRepository.findByName(clientId, dto.name);

    if (existingSite) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'A site with this name already exists.',
      );
    }

    const sequence = await counterService.next(ENTITY.SITE);

    const siteCode = generateCode(PREFIX.SITE, sequence);

    return siteRepository.create({
      clientId,
      siteCode,
      ...dto,
    });
  }

  async list(clientId: string, isActive?: boolean) {
    return siteRepository.list(clientId, isActive);
  }

  async get(id: string) {
    const site = await siteRepository.findById(id);

    if (!site) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Site not found.',
      );
    }

    return site;
  }

  async update(id: string, dto: UpdateSiteDto) {
    const site = await this.get(id);

    if (dto.name && dto.name !== site.name) {
      const existingSite = await siteRepository.findByName(
        site.clientId,
        dto.name,
      );

      if (existingSite) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          'A site with this name already exists.',
        );
      }
    }

    return siteRepository.update(id, dto);
  }

  async activate(id: string) {
    await this.get(id);

    await siteRepository.activate(id);

    return {
      message: 'Site activated successfully.',
    };
  }

  async deactivate(id: string) {
    await this.get(id);

    await siteRepository.deactivate(id);

    return {
      message: 'Site deactivated successfully.',
    };
  }
}

export const siteService = new SiteService();
