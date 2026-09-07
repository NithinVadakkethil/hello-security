import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { subTaskMasterRepository } from './subtask-master.repository';
import {
  CreateOrUpdateSubTaskMasterDto,
  ApplySubtaskMasterPreviewResponse,
  ApplySubtaskMasterExecuteResponse,
  RoleApplyPreviewResult,
} from './subtask-master.types';
import { auditLogService } from '../audit-log/audit-log.service';

function getRoleDisplayLabel(role: UserRole | string): string {
  switch (role) {
    case 'SECURITY':
      return 'Security Guard';
    case 'TECHNICIAN':
      return 'Technician';
    case 'CLEANER':
      return 'House Keeping';
    case 'SUPERVISOR':
      return 'Supervisor';
    case 'MANAGER':
      return 'Manager';
    case 'SERVICE_ENGINEER':
      return 'Service Engineer';
    case 'LIFE_GUARD':
      return 'Life Guard';
    case 'PLUMBER':
      return 'Plumber';
    case 'SHOP_KEEPER':
      return 'Shop Keeper';
    default:
      return String(role).replace(/_/g, ' ');
  }
}

export class SubTaskMasterService {
  async listMasters(clientId: string) {
    return subTaskMasterRepository.listByClient(clientId);
  }

  async getMasterByRole(clientId: string, role: UserRole) {
    return subTaskMasterRepository.findByClientAndRole(clientId, role);
  }

  async saveMaster(clientId: string, dto: CreateOrUpdateSubTaskMasterDto, userId?: string) {
    if (!dto.role) {
      throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'Role is required.');
    }

    // Filter empty items
    const cleanItems = (dto.items || [])
      .filter((item) => item.taskName && item.taskName.trim().length > 0)
      .map((item, idx) => ({
        taskName: item.taskName.trim(),
        description: item.description?.trim() || undefined,
        displayOrder: item.displayOrder ?? idx + 1,
        isRequired: item.isRequired ?? true,
        isActive: item.isActive ?? true,
      }));

    const result = await subTaskMasterRepository.upsertMasterWithItems(
      clientId,
      dto.role,
      dto.name,
      dto.description,
      cleanItems
    );

    if (userId && clientId && result) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'UPDATE',
        entity: 'SubTaskMaster',
        entityId: result.id,
      });
    }

    return result;
  }

  async deleteMaster(clientId: string, masterId: string, userId?: string) {
    await subTaskMasterRepository.deleteMaster(masterId, clientId);

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'DELETE',
        entity: 'SubTaskMaster',
        entityId: masterId,
      });
    }

    return { success: true };
  }

  /**
   * Generates preview for applying subtask masters to a site.
   * Performs NO database mutations.
   */
  async previewApplyMaster(
    clientId: string,
    siteId: string,
    roles: UserRole[]
  ): Promise<ApplySubtaskMasterPreviewResponse> {
    const site = await prisma.site.findFirst({
      where: { id: siteId, clientId },
      select: { id: true, name: true },
    });

    if (!site) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Site not found or access denied.');
    }

    const gates = await prisma.gate.findMany({
      where: { siteId },
      select: { id: true },
    });

    const checkpointCount = gates.length;
    const gateIds = gates.map((g) => g.id);

    // Fetch existing subtasks on site
    const existingSubTasks = checkpointCount > 0
      ? await prisma.gateSubTask.findMany({
          where: { gateId: { in: gateIds } },
          select: { gateId: true, role: true, taskName: true, sourceMasterItemId: true },
        })
      : [];

    // Build lookup maps for duplicate checking
    const existingByMasterItemId = new Set<string>();
    const existingByCompositeKey = new Set<string>();

    existingSubTasks.forEach((st) => {
      if (st.sourceMasterItemId) {
        existingByMasterItemId.add(`${st.gateId}:${st.sourceMasterItemId}`);
      }
      existingByCompositeKey.add(`${st.gateId}:${st.role}:${st.taskName.toLowerCase().trim()}`);
    });

    // Fetch masters for selected roles
    const selectedRoles = Array.from(new Set(roles));
    const roleResults: RoleApplyPreviewResult[] = [];

    let totalCreateCount = 0;
    let totalSkipCount = 0;

    for (const role of selectedRoles) {
      const master = await subTaskMasterRepository.findByClientAndRole(clientId, role);
      const activeItems = (master?.items || []).filter((i) => i.isActive);

      let roleCreateCount = 0;
      let roleSkipCount = 0;

      for (const item of activeItems) {
        for (const gateId of gateIds) {
          const hasByMasterId = existingByMasterItemId.has(`${gateId}:${item.id}`);
          const hasByComposite = existingByCompositeKey.has(`${gateId}:${role}:${item.taskName.toLowerCase().trim()}`);

          if (hasByMasterId || hasByComposite) {
            roleSkipCount++;
          } else {
            roleCreateCount++;
          }
        }
      }

      totalCreateCount += roleCreateCount;
      totalSkipCount += roleSkipCount;

      roleResults.push({
        role,
        roleDisplay: getRoleDisplayLabel(role),
        masterTaskCount: activeItems.length,
        createCount: roleCreateCount,
        skipCount: roleSkipCount,
      });
    }

    return {
      siteId: site.id,
      siteName: site.name,
      checkpointCount,
      roles: roleResults,
      totalCreateCount,
      totalSkipCount,
    };
  }

  /**
   * Executes bulk apply of subtask masters to a site's checkpoints.
   * Safe and batched idempotent implementation.
   */
  async executeApplyMaster(
    clientId: string,
    siteId: string,
    roles: UserRole[],
    userId?: string
  ): Promise<ApplySubtaskMasterExecuteResponse> {
    const site = await prisma.site.findFirst({
      where: { id: siteId, clientId },
      select: { id: true, name: true },
    });

    if (!site) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Site not found or access denied.');
    }

    const gates = await prisma.gate.findMany({
      where: { siteId },
      select: { id: true },
    });

    const checkpointCount = gates.length;
    if (checkpointCount === 0) {
      return {
        siteId: site.id,
        siteName: site.name,
        checkpointCount: 0,
        createdTasksCount: 0,
        skippedTasksCount: 0,
        roles: [],
      };
    }

    const gateIds = gates.map((g) => g.id);

    // Load existing subtasks on site
    const existingSubTasks = await prisma.gateSubTask.findMany({
      where: { gateId: { in: gateIds } },
      select: { gateId: true, role: true, taskName: true, sourceMasterItemId: true },
    });

    const existingByMasterItemId = new Set<string>();
    const existingByCompositeKey = new Set<string>();

    existingSubTasks.forEach((st) => {
      if (st.sourceMasterItemId) {
        existingByMasterItemId.add(`${st.gateId}:${st.sourceMasterItemId}`);
      }
      existingByCompositeKey.add(`${st.gateId}:${st.role}:${st.taskName.toLowerCase().trim()}`);
    });

    const selectedRoles = Array.from(new Set(roles));
    const roleResults: RoleApplyPreviewResult[] = [];
    const tasksToInsert: Array<{
      gateId: string;
      role: UserRole;
      taskName: string;
      description?: string | null;
      displayOrder: number;
      isRequired: boolean;
      isActive: boolean;
      sourceMasterItemId: string;
    }> = [];

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const role of selectedRoles) {
      const master = await subTaskMasterRepository.findByClientAndRole(clientId, role);
      const activeItems = (master?.items || []).filter((i) => i.isActive);

      let roleCreated = 0;
      let roleSkipped = 0;

      for (const item of activeItems) {
        for (const gateId of gateIds) {
          const hasByMasterId = existingByMasterItemId.has(`${gateId}:${item.id}`);
          const hasByComposite = existingByCompositeKey.has(`${gateId}:${role}:${item.taskName.toLowerCase().trim()}`);

          if (hasByMasterId || hasByComposite) {
            roleSkipped++;
          } else {
            roleCreated++;
            tasksToInsert.push({
              gateId,
              role,
              taskName: item.taskName.trim(),
              description: item.description?.trim() || null,
              displayOrder: item.displayOrder,
              isRequired: item.isRequired,
              isActive: item.isActive,
              sourceMasterItemId: item.id,
            });

            // Update local memory sets to avoid internal duplicates during batching
            existingByMasterItemId.add(`${gateId}:${item.id}`);
            existingByCompositeKey.add(`${gateId}:${role}:${item.taskName.toLowerCase().trim()}`);
          }
        }
      }

      totalCreated += roleCreated;
      totalSkipped += roleSkipped;

      roleResults.push({
        role,
        roleDisplay: getRoleDisplayLabel(role),
        masterTaskCount: activeItems.length,
        createCount: roleCreated,
        skipCount: roleSkipped,
      });
    }

    // Execute chunked insertions (500 subtask records per batch)
    const CHUNK_SIZE = 500;
    for (let i = 0; i < tasksToInsert.length; i += CHUNK_SIZE) {
      const chunk = tasksToInsert.slice(i, i + CHUNK_SIZE);
      await prisma.gateSubTask.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    if (userId && clientId && totalCreated > 0) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'CREATE',
        entity: 'GateSubTask',
        entityId: site.id,
      });
    }

    return {
      siteId: site.id,
      siteName: site.name,
      checkpointCount,
      createdTasksCount: totalCreated,
      skippedTasksCount: totalSkipped,
      roles: roleResults,
    };
  }
}

export const subTaskMasterService = new SubTaskMasterService();
