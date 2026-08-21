import { prisma } from '../../database/prisma';

export class GateRepository {
  create(data: any) {
    return prisma.gate.create({
      data,
    });
  }

  findById(id: string) {
    return prisma.gate.findUnique({
      where: {
        id,
      },
      include: {
        subTasks: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
    });
  }

  findByName(siteId: string, name: string) {
    return prisma.gate.findFirst({
      where: {
        siteId,
        name,
      },
    });
  }

  findByCode(gateCode: string) {
    return prisma.gate.findFirst({
      where: {
        gateCode,
        isActive: true,
      },
      include: {
        subTasks: {
          where: {
            isActive: true,
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
    });
  }

  findByUniqueCode(siteId: string, gateCode: string) {
    return prisma.gate.findFirst({
      where: {
        siteId,
        gateCode,
      },
    });
  }

  update(id: string, data: any) {
    return prisma.gate.update({
      where: {
        id,
      },
      data,
    });
  }

  activate(id: string) {
    return prisma.gate.update({
      where: {
        id,
      },
      data: {
        isActive: true,
      },
    });
  }

  deactivate(id: string) {
    return prisma.gate.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }

  async list(siteId?: string, isActive?: boolean, clientId?: string, page?: number, limit?: number, search?: string) {
    const where = {
      ...(siteId && { siteId }),
      ...(isActive !== undefined && { isActive }),
      ...(clientId && !siteId && { site: { clientId } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { gateCode: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const include = {
      subTasks: {
        orderBy: {
          displayOrder: 'asc' as const,
        },
      },
    };

    const orderBy = [
      { isActive: 'desc' as const },
      { sequence: 'asc' as const },
    ];

    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        prisma.gate.findMany({
          where,
          include,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.gate.count({ where }),
      ]);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }

    return prisma.gate.findMany({
      where,
      include,
      orderBy,
    });
  }

  findBySequence(siteId: string, sequence: number) {
    return prisma.gate.findFirst({
      where: {
        siteId,
        sequence,
      },
    });
  }
  delete(id: string) {
    return prisma.gate.delete({
      where: {
        id,
      },
    });
  }
}

export const gateRepository = new GateRepository();
