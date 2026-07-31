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

  list(siteId?: string, isActive?: boolean, clientId?: string) {
    return prisma.gate.findMany({
      where: {
        ...(siteId && { siteId }),
        ...(isActive !== undefined && { isActive }),
        ...(clientId && !siteId && { site: { clientId } }),
      },
      include: {
        subTasks: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
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
  delete(id: string) {
    return prisma.gate.delete({
      where: {
        id,
      },
    });
  }
}

export const gateRepository = new GateRepository();
