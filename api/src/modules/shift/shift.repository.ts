import { prisma } from '../../database/prisma';

export class ShiftRepository {
  create(data: any) {
    return prisma.shift.create({
      data,
    });
  }

  findById(id: string) {
    return prisma.shift.findUnique({
      where: {
        id,
      },
    });
  }

  findByShiftCode(clientId: string, shiftCode: string) {
    return prisma.shift.findFirst({
      where: {
        clientId,
        shiftCode,
      },
    });
  }

  findByName(clientId: string, name: string) {
    return prisma.shift.findFirst({
      where: {
        clientId,
        name,
      },
    });
  }

  update(id: string, data: any) {
    return prisma.shift.update({
      where: {
        id,
      },
      data,
    });
  }

  activate(id: string) {
    return prisma.shift.update({
      where: {
        id,
      },
      data: {
        isActive: true,
      },
    });
  }

  deactivate(id: string) {
    return prisma.shift.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }

  async list(clientId?: string, isActive?: boolean, siteId?: string) {
    if (siteId && clientId) {
      const siteShifts = await prisma.shift.findMany({
        where: {
          clientId,
          ...(isActive !== undefined && { isActive }),
          assignments: { some: { siteId, isActive: true } },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      if (siteShifts.length > 0) {
        return siteShifts;
      }
    }

    return prisma.shift.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

export const shiftRepository = new ShiftRepository();
