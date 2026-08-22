import { prisma } from '../../database/prisma';

export class SnagCategoryRepository {
  list(clientId: string) {
    return prisma.snagCategory.findMany({
      where: { clientId },
      include: {
        subCategories: { orderBy: { createdAt: 'asc' } },
        _count: { select: { snags: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  createCategory(clientId: string, name: string, description?: string) {
    return prisma.snagCategory.create({
      data: {
        clientId,
        name,
        description: description || null,
      },
      include: { subCategories: true },
    });
  }

  updateCategory(id: string, clientId: string, data: { name?: string; description?: string; isActive?: boolean }) {
    return prisma.snagCategory.updateMany({
      where: { id, clientId },
      data,
    });
  }

  deleteCategory(id: string, clientId: string) {
    return prisma.snagCategory.deleteMany({
      where: { id, clientId },
    });
  }

  createSubCategory(categoryId: string, name: string, description?: string) {
    return prisma.snagSubCategory.create({
      data: {
        categoryId,
        name,
        description: description || null,
      },
    });
  }

  deleteSubCategory(id: string) {
    return prisma.snagSubCategory.delete({
      where: { id },
    });
  }
}

export const snagCategoryRepository = new SnagCategoryRepository();
