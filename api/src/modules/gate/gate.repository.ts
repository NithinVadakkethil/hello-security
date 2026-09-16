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

  async getFloors(siteId: string, clientId?: string) {
    const where: any = {
      siteId,
      ...(clientId && { site: { clientId } }),
    };

    const gates = await prisma.gate.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
      },
    });

    const floorMap = new Map<
      string,
      {
        floor: string;
        totalCheckpoints: number;
        activeCheckpoints: number;
        inactiveCheckpoints: number;
      }
    >();

    for (const gate of gates) {
      const rawFloor = (gate.description && gate.description.trim()) || 'Unassigned Floor';
      const key = rawFloor.toLowerCase();

      if (!floorMap.has(key)) {
        floorMap.set(key, {
          floor: rawFloor,
          totalCheckpoints: 0,
          activeCheckpoints: 0,
          inactiveCheckpoints: 0,
        });
      }

      const item = floorMap.get(key)!;
      item.totalCheckpoints++;
      if (gate.isActive) {
        item.activeCheckpoints++;
      } else {
        item.inactiveCheckpoints++;
      }
    }

    const floors = Array.from(floorMap.values());
    floors.sort((a, b) => {
      if (a.floor === 'Unassigned Floor') return 1;
      if (b.floor === 'Unassigned Floor') return -1;
      return a.floor.localeCompare(b.floor, undefined, { numeric: true, sensitivity: 'base' });
    });

    return floors;
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
    const where: any = {
      ...(siteId && { siteId }),
      ...(isActive !== undefined && { isActive }),
      ...(clientId && !siteId && { site: { clientId } }),
    };

    if (floor) {
      if (
        floor === 'Unassigned Floor' ||
        floor === 'No Floor Assigned' ||
        floor.trim() === ''
      ) {
        where.OR = [
          { description: null },
          { description: '' },
        ];
      } else {
        where.description = { contains: floor.trim(), mode: 'insensitive' as const };
      }
    }

    if (search && search.trim() !== '') {
      const s = search.trim();
      const searchOR = [
        { name: { contains: s, mode: 'insensitive' as const } },
        { gateCode: { contains: s, mode: 'insensitive' as const } },
        { description: { contains: s, mode: 'insensitive' as const } },
      ];

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOR }];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }

    const include = {
      subTasks: {
        where: {
          isActive: true,
        },
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

  async listBySequenceRange(siteId: string, fromSeq?: number, toSeq?: number, clientId?: string) {
    const where: any = {
      siteId,
      ...(clientId && { site: { clientId } }),
    };

    if (fromSeq !== undefined || toSeq !== undefined) {
      where.sequence = {
        ...(fromSeq !== undefined && { gte: fromSeq }),
        ...(toSeq !== undefined && { lte: toSeq }),
      };
    }

    const [items, totalSiteCount] = await Promise.all([
      prisma.gate.findMany({
        where,
        orderBy: { sequence: 'asc' },
      }),
      prisma.gate.count({
        where: {
          siteId,
          ...(clientId && { site: { clientId } }),
        },
      }),
    ]);

    return {
      items,
      totalSiteCount,
    };
  }

  findBySequence(siteId: string, sequence: number) {
    return prisma.gate.findFirst({
      where: {
        siteId,
        sequence,
      },
    });
  }

  async getNextSequence(siteId: string): Promise<number> {
    const maxGate = await prisma.gate.findFirst({
      where: {
        siteId,
      },
      orderBy: {
        sequence: 'desc',
      },
      select: {
        sequence: true,
      },
    });

    return (maxGate?.sequence ?? 0) + 1;
  }

  delete(id: string, tx?: any) {
    const client = tx || prisma;
    return client.gate.delete({
      where: {
        id,
      },
    });
  }
}

export const gateRepository = new GateRepository();
