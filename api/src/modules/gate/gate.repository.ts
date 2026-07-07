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

  list(siteId: string, isActive?: boolean) {
    return prisma.gate.findMany({
      where: {
        siteId,
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: {
        sequence: 'asc',
      },
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
}

export const gateRepository = new GateRepository();
