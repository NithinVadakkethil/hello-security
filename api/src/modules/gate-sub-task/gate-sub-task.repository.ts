import { prisma } from '../../database/prisma';
import { CreateGateSubTaskDto, UpdateGateSubTaskDto } from './gate-sub-task.types';

export class GateSubTaskRepository {
  async findById(id: string) {
    return prisma.gateSubTask.findUnique({
      where: { id },
      include: {
        gate: {
          select: {
            id: true,
            siteId: true,
            site: {
              select: {
                clientId: true,
              },
            },
          },
        },
      },
    });
  }

  async findByGateAndName(gateId: string, taskName: string) {
    return prisma.gateSubTask.findFirst({
      where: {
        gateId,
        taskName: {
          equals: taskName,
          mode: 'insensitive',
        },
      },
    });
  }

  async listByGate(gateId: string, onlyActive = false) {
    return prisma.gateSubTask.findMany({
      where: {
        gateId,
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }

  async countByGate(gateId: string) {
    return prisma.gateSubTask.count({
      where: { gateId },
    });
  }

  async create(gateId: string, dto: CreateGateSubTaskDto) {
    const count = await this.countByGate(gateId);
    return prisma.gateSubTask.create({
      data: {
        gateId,
        taskName: dto.taskName.trim(),
        description: dto.description?.trim() || null,
        displayOrder: dto.displayOrder ?? count,
        isRequired: dto.isRequired ?? true,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateGateSubTaskDto) {
    return prisma.gateSubTask.update({
      where: { id },
      data: {
        ...(dto.taskName !== undefined ? { taskName: dto.taskName.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async delete(id: string) {
    return prisma.gateSubTask.delete({
      where: { id },
    });
  }

  async reorder(items: Array<{ id: string; displayOrder: number }>) {
    return prisma.$transaction(
      items.map((item) =>
        prisma.gateSubTask.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
  }
}

export const gateSubTaskRepository = new GateSubTaskRepository();
