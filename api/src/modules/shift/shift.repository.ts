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

  findByShiftCode(shiftCode: string) {
    return prisma.shift.findUnique({
      where: {
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

  list(clientId: string, isActive?: boolean) {
    return prisma.shift.findMany({
      where: {
        clientId,
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

export const shiftRepository = new ShiftRepository();
