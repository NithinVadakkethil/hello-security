import { UserRole } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { gateSubTaskRepository } from './gate-sub-task.repository';
import { CreateGateSubTaskDto, UpdateGateSubTaskDto } from './gate-sub-task.types';
import { auditLogService } from '../audit-log/audit-log.service';
import { prisma } from '../../database/prisma';

export async function resolveGateRecord(gateIdInput: string) {
  if (!gateIdInput) return null;
  return prisma.gate.findFirst({
    where: {
      OR: [
        { id: gateIdInput },
        { gateCode: gateIdInput },
        { qrCode: gateIdInput },
      ],
    },
    include: {
      site: true,
    },
  });
}

export async function ensureGateSubTasksFromMaster(
  gateId: string,
  role: UserRole,
  clientId?: string,
): Promise<void> {
  if (!gateId || !role) return;

  const existingCount = await prisma.gateSubTask.count({
    where: { gateId, role },
  });

  if (existingCount > 0) {
    return;
  }

  let targetClientId = clientId;
  if (!targetClientId) {
    const gate = await prisma.gate.findUnique({
      where: { id: gateId },
      select: { site: { select: { clientId: true } } },
    });
    targetClientId = gate?.site?.clientId;
  }

  if (!targetClientId) return;

  const master = await prisma.subTaskMaster.findFirst({
    where: { clientId: targetClientId, role, isActive: true },
    include: {
      items: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  if (!master || !master.items || master.items.length === 0) {
    return;
  }

  for (const item of master.items) {
    const existing = await prisma.gateSubTask.findFirst({
      where: {
        gateId,
        role,
        taskName: { equals: item.taskName, mode: 'insensitive' },
      },
    });

    if (!existing) {
      await prisma.gateSubTask.create({
        data: {
          gateId,
          role,
          taskName: item.taskName,
          description: item.description,
          displayOrder: item.displayOrder,
          isRequired: item.isRequired,
          isActive: item.isActive ?? true,
          sourceMasterItemId: item.id,
        },
      });
    }
  }
}

export class GateSubTaskService {
  async create(gateIdInput: string, dto: CreateGateSubTaskDto, userId?: string, clientId?: string) {
    const gate = await resolveGateRecord(gateIdInput);
    if (!gate) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Gate not found.');
    }

    const role = dto.role || 'SECURITY';
    const existing = await gateSubTaskRepository.findByGateAndNameAndRole(gate.id, dto.taskName.trim(), role);
    if (existing) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        `A sub-task named "${dto.taskName.trim()}" already exists for role ${role} at this gate.`,
      );
    }

    const subTask = await gateSubTaskRepository.create(gate.id, dto);

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'CREATE',
        entity: 'GateSubTask',
        entityId: subTask.id,
      });
    }

    return subTask;
  }

  async list(gateIdInput: string, onlyActive = false, role?: UserRole) {
    const gate = await resolveGateRecord(gateIdInput);
    if (!gate) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Gate not found.');
    }

    if (role) {
      await ensureGateSubTasksFromMaster(gate.id, role, gate.site?.clientId);
    }

    return gateSubTaskRepository.listByGate(gate.id, onlyActive, role);
  }

  async get(id: string) {
    const subTask = await gateSubTaskRepository.findById(id);
    if (!subTask) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Gate sub-task not found.');
    }
    return subTask;
  }

  async update(id: string, dto: UpdateGateSubTaskDto, userId?: string, clientId?: string) {
    const subTask = await this.get(id);
    const targetRole = dto.role || subTask.role;

    if (dto.taskName && (dto.taskName.trim().toLowerCase() !== subTask.taskName.toLowerCase() || targetRole !== subTask.role)) {
      const existing = await gateSubTaskRepository.findByGateAndNameAndRole(subTask.gateId, dto.taskName.trim(), targetRole);
      if (existing && existing.id !== id) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          `A sub-task named "${dto.taskName.trim()}" already exists for role ${targetRole} at this gate.`,
        );
      }
    }

    const updated = await gateSubTaskRepository.update(id, dto);

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'UPDATE',
        entity: 'GateSubTask',
        entityId: updated.id,
      });
    }

    return updated;
  }

  async delete(id: string, userId?: string, clientId?: string) {
    await this.get(id);

    await gateSubTaskRepository.delete(id);

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'DELETE',
        entity: 'GateSubTask',
        entityId: id,
      });
    }

    return { success: true, id };
  }

  async reorder(gateIdInput: string, dto: { subTasks: Array<{ id: string; displayOrder: number }> }, userId?: string, clientId?: string) {
    const gate = await resolveGateRecord(gateIdInput);
    if (!gate) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Gate not found.');
    }

    const updated = await gateSubTaskRepository.reorder(dto.subTasks);

    if (userId && clientId && dto.subTasks.length > 0) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'UPDATE',
        entity: 'GateSubTask',
        entityId: dto.subTasks[0].id,
      });
    }

    return updated;
  }
}

export const gateSubTaskService = new GateSubTaskService();

