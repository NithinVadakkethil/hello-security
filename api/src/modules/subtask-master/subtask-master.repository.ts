import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { CreateSubTaskMasterItemDto } from './subtask-master.types';

export class SubTaskMasterRepository {
  async findByClientAndRole(clientId: string, role: UserRole) {
    return prisma.subTaskMaster.findUnique({
      where: {
        clientId_role: {
          clientId,
          role,
        },
      },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  async listByClient(clientId: string) {
    return prisma.subTaskMaster.findMany({
      where: { clientId },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { role: 'asc' },
    });
  }

  async upsertMasterWithItems(
    clientId: string,
    role: UserRole,
    name?: string,
    description?: string,
    items: CreateSubTaskMasterItemDto[] = []
  ) {
    return prisma.$transaction(async (tx) => {
      let master = await tx.subTaskMaster.findUnique({
        where: {
          clientId_role: { clientId, role },
        },
      });

      if (!master) {
        master = await tx.subTaskMaster.create({
          data: {
            clientId,
            role,
            name: name || `${role} Master`,
            description,
          },
        });
      } else {
        master = await tx.subTaskMaster.update({
          where: { id: master.id },
          data: {
            name: name || master.name,
            description: description !== undefined ? description : master.description,
          },
        });
      }

      // Delete existing items and recreate to reflect updated list & order cleanly
      await tx.subTaskMasterItem.deleteMany({
        where: { masterId: master.id },
      });

      if (items.length > 0) {
        await tx.subTaskMasterItem.createMany({
          data: items.map((item, idx) => ({
            masterId: master.id,
            taskName: item.taskName.trim(),
            description: item.description?.trim() || null,
            displayOrder: item.displayOrder ?? idx + 1,
            isRequired: item.isRequired ?? true,
            isActive: item.isActive ?? true,
          })),
        });
      }

      return tx.subTaskMaster.findUnique({
        where: { id: master.id },
        include: {
          items: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
    });
  }

  async deleteMaster(id: string, clientId: string) {
    return prisma.subTaskMaster.deleteMany({
      where: {
        id,
        clientId,
      },
    });
  }

  async findMasterItemById(itemId: string) {
    return prisma.subTaskMasterItem.findUnique({
      where: { id: itemId },
      include: { master: true },
    });
  }
}

export const subTaskMasterRepository = new SubTaskMasterRepository();
