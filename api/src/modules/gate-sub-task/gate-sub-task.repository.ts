import { UserRole } from '@prisma/client';
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

  async findByGateAndNameAndRole(gateId: string, taskName: string, role: UserRole = 'SECURITY') {
    return prisma.gateSubTask.findFirst({
      where: {
        gateId,
        role,
        taskName: {
          equals: taskName,
          mode: 'insensitive',
        },
      },
    });
  }

  async listByGate(gateId: string, onlyActive = false, role?: UserRole) {
    return prisma.gateSubTask.findMany({
      where: {
        gateId,
        ...(role ? { role } : {}),
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: [
        { isActive: 'desc' },
        { displayOrder: 'asc' },
      ],
    });
  }

  async countByGate(gateId: string, role?: UserRole) {
    return prisma.gateSubTask.count({
      where: {
        gateId,
        ...(role ? { role } : {}),
      },
    });
  }

  async create(gateId: string, dto: CreateGateSubTaskDto) {
    const role = dto.role || 'SECURITY';
    const count = await this.countByGate(gateId, role);
    return prisma.gateSubTask.create({
      data: {
        gateId,
        role,
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
        ...(dto.role !== undefined ? { role: dto.role } : {}),
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
