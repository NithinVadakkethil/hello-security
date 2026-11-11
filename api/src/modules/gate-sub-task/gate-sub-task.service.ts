import { UserRole } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { CurrentUser } from '../../common/auth/current-user';
import { assertTenantAccess, getAuthorizedClientIds } from '../../common/auth/tenant-access';
import { gateSubTaskRepository } from './gate-sub-task.repository';
import { CreateGateSubTaskDto, UpdateGateSubTaskDto } from './gate-sub-task.types';
import { auditLogService } from '../audit-log/audit-log.service';
import { prisma } from '../../database/prisma';

export async function resolveGateRecord(
  gateIdInput: string,
  scopedClientIds?: string[] | null,
) {
  if (!gateIdInput) return null;

  if (scopedClientIds && scopedClientIds.length > 0) {
    const scopedMatch = await prisma.gate.findFirst({
      where: {
        OR: [
          { id: gateIdInput },
          { qrCode: gateIdInput },
          { gateCode: gateIdInput, site: { clientId: { in: scopedClientIds } } },
        ],
      },
      include: { site: true },
    });
    if (scopedMatch) return scopedMatch;
  }

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
  private async resolveAuthorizedGate(gateIdInput: string, user?: CurrentUser) {
    const scopedClientIds = user ? await getAuthorizedClientIds(user) : undefined;
    const gate = await resolveGateRecord(gateIdInput, scopedClientIds);
    if (!gate) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Gate not found.');
    }

    await assertTenantAccess(
      user,
      gate.site?.clientId,
      'Access denied. Gate does not belong to your organization.',
    );

    return gate;
  }

  async create(
    gateIdInput: string,
    dto: CreateGateSubTaskDto,
    userId?: string,
    clientId?: string,
    user?: CurrentUser,
  ) {
    const gate = await this.resolveAuthorizedGate(gateIdInput, user);
    const auditClientId = clientId || gate.site?.clientId;

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

    if (userId && auditClientId) {
      await auditLogService.create({
        userId,
        clientId: auditClientId,
        action: 'CREATE',
        entity: 'GateSubTask',
        entityId: subTask.id,
      });
    }

    return subTask;
  }

  async list(gateIdInput: string, onlyActive = true, role?: UserRole, user?: CurrentUser) {
    const gate = await this.resolveAuthorizedGate(gateIdInput, user);

    if (gate.categoryId) {
      const categorySubTasks = await prisma.categorySubTask.findMany({
        where: {
          categoryId: gate.categoryId,
          ...(role ? { role } : {}),
          ...(onlyActive ? { isActive: true } : {}),
        },
        orderBy: [
          { isActive: 'desc' },
          { displayOrder: 'asc' },
        ],
      });

      if (categorySubTasks.length > 0) {
        return categorySubTasks.map((st) => ({
          id: st.id,
          gateId: gate.id,
          role: st.role,
          taskName: st.taskName,
          description: st.description,
          displayOrder: st.displayOrder,
          isRequired: st.isRequired,
          isActive: st.isActive,
          createdAt: st.createdAt,
          updatedAt: st.updatedAt,
          isCategorySubTask: true,
          categoryId: st.categoryId,
        }));
      }
    }

    return gateSubTaskRepository.listByGate(gate.id, onlyActive, role);
  }

  async get(id: string, user?: CurrentUser) {
    const subTask = await gateSubTaskRepository.findById(id);
    if (!subTask) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Gate sub-task not found.');
    }

    await assertTenantAccess(
      user,
      (subTask as any).gate?.site?.clientId,
      'Access denied. Gate sub-task does not belong to your organization.',
    );

    return subTask;
  }

  async update(
    id: string,
    dto: UpdateGateSubTaskDto,
    userId?: string,
    clientId?: string,
    user?: CurrentUser,
  ) {
    const subTask = await this.get(id, user);
    const auditClientId = clientId || (subTask as any).gate?.site?.clientId;
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

    if (userId && auditClientId) {
      await auditLogService.create({
        userId,
        clientId: auditClientId,
        action: 'UPDATE',
        entity: 'GateSubTask',
        entityId: updated.id,
      });
    }

    return updated;
  }

  async delete(id: string, userId?: string, clientId?: string, user?: CurrentUser) {
    const subTask = await this.get(id, user);
    const auditClientId = clientId || (subTask as any).gate?.site?.clientId;

    await gateSubTaskRepository.update(id, { isActive: false });

    if (userId && auditClientId) {
      await auditLogService.create({
        userId,
        clientId: auditClientId,
        action: 'DELETE',
        entity: 'GateSubTask',
        entityId: id,
      });
    }

    return { success: true, id };
  }

  async reorder(
    gateIdInput: string,
    dto: { subTasks: Array<{ id: string; displayOrder: number }> },
    userId?: string,
    clientId?: string,
    user?: CurrentUser,
  ) {
    const gate = await this.resolveAuthorizedGate(gateIdInput, user);
    const auditClientId = clientId || gate.site?.clientId;

    if (dto.subTasks.length > 0) {
      const ids = dto.subTasks.map((st) => st.id);
      const validCount = await prisma.gateSubTask.count({
        where: { id: { in: ids }, gateId: gate.id },
      });
      if (validCount !== new Set(ids).size) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'Access denied. One or more sub-tasks do not belong to this gate.',
        );
      }
    }

    const updated = await gateSubTaskRepository.reorder(dto.subTasks);

    if (userId && auditClientId && dto.subTasks.length > 0) {
      await auditLogService.create({
        userId,
        clientId: auditClientId,
        action: 'UPDATE',
        entity: 'GateSubTask',
        entityId: dto.subTasks[0].id,
      });
    }

    return updated;
  }
}

export const gateSubTaskService = new GateSubTaskService();

