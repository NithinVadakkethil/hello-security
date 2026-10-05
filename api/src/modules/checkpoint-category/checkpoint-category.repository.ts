import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  CreateCategorySubTaskDto,
  UpdateCategorySubTaskDto,
} from './checkpoint-category.types';

export class CheckpointCategoryRepository {
  async listByClient(clientId: string) {
    return prisma.checkpointCategory.findMany({
      where: { clientId },
      include: {
        _count: {
          select: {
            gates: true,
            subTasks: {
              where: { isActive: true },
            },
          },
        },
        subTasks: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            taskName: true,
            description: true,
            displayOrder: true,
            isRequired: true,
            isActive: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.checkpointCategory.findUnique({
      where: { id },
      include: {
        gates: {
          select: {
            id: true,
            name: true,
            gateCode: true,
            description: true,
            sequence: true,
            site: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { sequence: 'asc' },
        },
        subTasks: {
          orderBy: [{ role: 'asc' }, { displayOrder: 'asc' }],
        },
        _count: {
          select: {
            gates: true,
            subTasks: true,
          },
        },
      },
    });
  }

  async findByNormalizedName(clientId: string, normalizedName: string) {
    return prisma.checkpointCategory.findUnique({
      where: {
        clientId_normalizedName: {
          clientId,
          normalizedName,
        },
      },
    });
  }

  async create(data: { clientId: string; name: string; normalizedName: string; description?: string | null }) {
    return prisma.checkpointCategory.create({
      data,
      include: {
        subTasks: true,
        _count: {
          select: {
            gates: true,
            subTasks: true,
          },
        },
      },
    });
  }

  async update(id: string, data: { name?: string; normalizedName?: string; description?: string | null }) {
    return prisma.checkpointCategory.update({
      where: { id },
      data,
      include: {
        subTasks: true,
        _count: {
          select: {
            gates: true,
            subTasks: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.checkpointCategory.delete({
      where: { id },
    });
  }

  async countAssignedGates(categoryId: string) {
    return prisma.gate.count({
      where: { categoryId },
    });
  }

  // --- Category SubTasks ---

  async findSubTaskById(id: string) {
    return prisma.categorySubTask.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async findSubTaskByNameAndRole(categoryId: string, role: UserRole, taskName: string) {
    return prisma.categorySubTask.findFirst({
      where: {
        categoryId,
        role,
        taskName: { equals: taskName, mode: 'insensitive' },
      },
    });
  }

  async listSubTasksByCategory(categoryId: string, role?: UserRole) {
    return prisma.categorySubTask.findMany({
      where: {
        categoryId,
        ...(role ? { role } : {}),
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createSubTask(categoryId: string, dto: CreateCategorySubTaskDto) {
    let displayOrder = dto.displayOrder;
    if (displayOrder === undefined) {
      const maxOrder = await prisma.categorySubTask.aggregate({
        where: { categoryId, role: dto.role },
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;
    }

    return prisma.categorySubTask.create({
      data: {
        categoryId,
        role: dto.role,
        taskName: dto.taskName.trim(),
        description: dto.description?.trim() || null,
        displayOrder,
        isRequired: dto.isRequired ?? true,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateSubTask(id: string, dto: UpdateCategorySubTaskDto) {
    return prisma.categorySubTask.update({
      where: { id },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.taskName ? { taskName: dto.taskName.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteSubTask(id: string) {
    return prisma.categorySubTask.delete({
      where: { id },
    });
  }

  async reorderSubTasks(items: Array<{ id: string; displayOrder: number }>) {
    return prisma.$transaction(
      items.map((item) =>
        prisma.categorySubTask.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );
  }

  /**
   * Delete All Subtasks (Demo cleanup feature):
   * Safely removes ALL checkpoint subtask configuration records:
   * 1. CategorySubTask (category-level subtask templates)
   * 2. GateSubTask (checkpoint-specific subtask items across all client gates)
   * 3. SubTaskMasterItem & SubTaskMaster (client-wide master templates)
   *
   * Categories, Checkpoints, QR codes, Sites, and historical patrol scan responses remain 100% untouched.
   */
  async deleteAllSubTasksForClient(clientId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete all CategorySubTask for client's CheckpointCategories
      const deletedCategorySubTasks = await tx.categorySubTask.deleteMany({
        where: {
          category: {
            clientId,
          },
        },
      });

      // 2. Delete all GateSubTask for all gates of client's sites
      const deletedGateSubTasks = await tx.gateSubTask.deleteMany({
        where: {
          gate: {
            site: {
              clientId,
            },
          },
        },
      });

      // 3. Delete all SubTaskMasterItem for client's SubTaskMasters
      const deletedSubTaskMasterItems = await tx.subTaskMasterItem.deleteMany({
        where: {
          master: {
            clientId,
          },
        },
      });

      // 4. Delete all SubTaskMaster for client
      const deletedSubTaskMasters = await tx.subTaskMaster.deleteMany({
        where: {
          clientId,
        },
      });

      const totalDeleted =
        deletedCategorySubTasks.count +
        deletedGateSubTasks.count +
        deletedSubTaskMasterItems.count;

      return {
        deletedCategorySubTasksCount: deletedCategorySubTasks.count,
        deletedGateSubTasksCount: deletedGateSubTasks.count,
        deletedSubTaskMasterItemsCount: deletedSubTaskMasterItems.count,
        deletedSubTaskMastersCount: deletedSubTaskMasters.count,
        deletedCount: totalDeleted,
        totalDeleted,
      };
    });
  }
}

export const checkpointCategoryRepository = new CheckpointCategoryRepository();
