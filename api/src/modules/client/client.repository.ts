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

  findByClientCode(clientCode: string) {
    return prisma.client.findUnique({
      where: { clientCode },
    });
  }

  findById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            lastLogin: true,
            rawPassword: true,
          },
        },
        _count: {
          select: {
            employees: true,
            sites: true,
            shifts: true,
            patrolRoutes: true,
          },
        },
        auditLogs: {
          take: 5,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
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
