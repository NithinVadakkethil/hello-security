import { prisma } from '../../database/prisma';

export class SiteRepository {
  create(data: any) {
    return prisma.site.create({
      data,
    });
  }

  findById(id: string) {
    return prisma.site.findUnique({
      where: {
        id,
      },
    });
  }

  findByCode(clientId: string, siteCode: string) {
    return prisma.site.findFirst({
      where: {
        clientId,
        siteCode,
      },
    });
  }

  findByName(clientId: string, name: string) {
    return prisma.site.findFirst({
      where: {
        clientId,
        name,
      },
    });
  }

  update(id: string, data: any) {
    return prisma.site.update({
      where: {
        id,
      },
      data,
    });
  }

  activate(id: string) {
    return prisma.site.update({
      where: {
        id,
      },
      data: {
        isActive: true,
      },
    });
  }

  deactivate(id: string) {
    return prisma.site.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }

  list(clientId: string, isActive?: boolean) {
    return prisma.site.findMany({
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

export const siteRepository = new SiteRepository();
