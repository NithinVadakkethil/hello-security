import { Prisma } from '@prisma/client';

import { prisma } from '../../database/prisma';

export class ClientRepository {
  create(data: Prisma.ClientCreateInput) {
    return prisma.client.create({
      data,
    });
  }

  findByEmail(email: string) {
    return prisma.client.findUnique({
      where: { email },
    });
  }

  findById(id: string) {
    return prisma.client.findUnique({
      where: { id },
    });
  }

  update(id: string, data: Prisma.ClientUpdateInput) {
    return prisma.client.update({
      where: { id },
      data,
    });
  }

  list(skip: number, take: number, search?: string) {
    return prisma.client.findMany({
      where: search
        ? {
            OR: [
              {
                companyName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {},
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  count(search?: string) {
    return prisma.client.count({
      where: search
        ? {
            OR: [
              {
                companyName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {},
    });
  }
}

export const clientRepository = new ClientRepository();
