import { UserRole } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { gateRepository } from '../gate/gate.repository';
import { gateSubTaskRepository } from './gate-sub-task.repository';
import { CreateGateSubTaskDto, UpdateGateSubTaskDto } from './gate-sub-task.types';
import { auditLogService } from '../audit-log/audit-log.service';

export class GateSubTaskService {
  async create(gateId: string, dto: CreateGateSubTaskDto, userId?: string, clientId?: string) {
    const gate = await gateRepository.findById(gateId);
    if (!gate) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Gate not found.');
    }

    const role = dto.role || 'SECURITY';
    const existing = await gateSubTaskRepository.findByGateAndNameAndRole(gateId, dto.taskName.trim(), role);
    if (existing) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        `A sub-task named "${dto.taskName.trim()}" already exists for role ${role} at this gate.`,
      );
    }

    const subTask = await gateSubTaskRepository.create(gateId, dto);

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

  async list(gateId: string, onlyActive = false, role?: UserRole) {
    const gate = await gateRepository.findById(gateId);
    if (!gate) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Gate not found.');
    }
    return gateSubTaskRepository.listByGate(gateId, onlyActive, role);
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

  async reorder(gateId: string, dto: { subTasks: Array<{ id: string; displayOrder: number }> }, userId?: string, clientId?: string) {
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
