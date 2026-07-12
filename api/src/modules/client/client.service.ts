import { randomBytes } from 'crypto';

import { UserRole } from '@prisma/client';

import { prisma } from '../../database/prisma';

import { hashPassword } from '../../common/auth/bcrypt';
import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';
import { counterService } from '../../common/counter/counter.service';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { generateCode } from '../../common/utils/code-generator';

import { clientRepository } from './client.repository';
import { CreateClientDto, UpdateClientDto } from './client.types';

export class ClientService {
  async create(data: CreateClientDto) {
    const existingClient = await clientRepository.findByEmail(data.email);

    if (existingClient) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'A client with this email already exists.',
      );
    }

    const temporaryPassword = randomBytes(6).toString('hex');

    const hashedPassword = await hashPassword(temporaryPassword);
    const sequence = await counterService.next(ENTITY.CLIENT);

    const clientCode = generateCode(PREFIX.CLIENT, sequence);

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          ...data,
          clientCode,
        },
      });

      const admin = await tx.user.create({
        data: {
          clientId: client.id,
          email: data.email,
          password: hashedPassword,
          rawPassword: temporaryPassword,
          role: UserRole.CLIENT_ADMIN,
        },
      });

      return {
        client,
        admin,
      };
    });

    return {
      client: result.client,
      temporaryPassword,
    };
  }

  async list(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      clientRepository.list(skip, limit, search),
      clientRepository.count(search),
    ]);

    return {
      items: clients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const client = await clientRepository.findById(id);

    if (!client) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Client not found.',
      );
    }

    return client;
  }

  async update(id: string, data: UpdateClientDto) {
    await this.getById(id);

    return clientRepository.update(id, data);
  }
}

export const clientService = new ClientService();
