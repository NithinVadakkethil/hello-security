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
          where: { isActive: true },
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
          where: { isActive: true },
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

      // Reconcile items to preserve IDs and avoid nullifying sourceMasterItemId on GateSubTasks
      const existingItems = await tx.subTaskMasterItem.findMany({
        where: { masterId: master.id },
      });

      const existingById = new Map(existingItems.map((item) => [item.id, item]));
      const existingByName = new Map(existingItems.map((item) => [item.taskName.trim().toLowerCase(), item]));

      const processedItemIds = new Set<string>();

      for (let idx = 0; idx < items.length; idx++) {
        const itemDto = items[idx];
        const normalizedName = itemDto.taskName.trim().toLowerCase();

        const matched = (itemDto.id && existingById.get(itemDto.id)) || existingByName.get(normalizedName);

        if (matched) {
          processedItemIds.add(matched.id);
          await tx.subTaskMasterItem.update({
            where: { id: matched.id },
            data: {
              taskName: itemDto.taskName.trim(),
              description: itemDto.description?.trim() || null,
              displayOrder: itemDto.displayOrder ?? idx + 1,
              isRequired: itemDto.isRequired ?? true,
              isActive: itemDto.isActive ?? true,
            },
          });
        } else {
          const newItem = await tx.subTaskMasterItem.create({
            data: {
              masterId: master.id,
              taskName: itemDto.taskName.trim(),
              description: itemDto.description?.trim() || null,
              displayOrder: itemDto.displayOrder ?? idx + 1,
              isRequired: itemDto.isRequired ?? true,
              isActive: itemDto.isActive ?? true,
            },
          });
          processedItemIds.add(newItem.id);
        }
      }

      // Any existing item NOT in processedItemIds was removed by user -> soft deactivate it
      const itemsToDeactivate = existingItems.filter((i) => !processedItemIds.has(i.id) && i.isActive);
      if (itemsToDeactivate.length > 0) {
        await tx.subTaskMasterItem.updateMany({
          where: { id: { in: itemsToDeactivate.map((i) => i.id) } },
          data: { isActive: false },
        });
      }

      return tx.subTaskMaster.findUnique({
        where: { id: master.id },
        include: {
          items: {
            where: { isActive: true },
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
