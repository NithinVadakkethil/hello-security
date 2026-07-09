import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

export class AuditLogRepository {
  async list(
    skip: number,
    take: number,
    search?: string,
    action?: string,
    entity?: string,
    userId?: string,
    clientId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: Prisma.AuditLogWhereInput = {};

    if (search) {
      where.OR = [
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { userAgent: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (action) {
      where.action = action as any;
    }

    if (entity) {
      where.entity = { contains: entity, mode: 'insensitive' };
    }

    if (userId) {
      where.userId = userId;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    return prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });
  }

  async count(
    search?: string,
    action?: string,
    entity?: string,
    userId?: string,
    clientId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: Prisma.AuditLogWhereInput = {};

    if (search) {
      where.OR = [
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { userAgent: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (action) {
      where.action = action as any;
    }

    if (entity) {
      where.entity = { contains: entity, mode: 'insensitive' };
    }

    if (userId) {
      where.userId = userId;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    return prisma.auditLog.count({ where });
  }

  async create(data: Prisma.AuditLogUncheckedCreateInput) {
    return prisma.auditLog.create({
      data,
    });
  }
}

export const auditLogRepository = new AuditLogRepository();
