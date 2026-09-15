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
        id: item.id,
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

    const selectedRoles = Array.from(new Set(roles));
    const roleResults: RoleApplyPreviewResult[] = [];

    let totalCreateCount = 0;
    let totalUpdateCount = 0;
    let totalRemoveCount = 0;
    let totalPreserveManualCount = 0;
    let totalSkipCount = 0;

    for (const role of selectedRoles) {
      const master = await subTaskMasterRepository.findByClientAndRole(clientId, role);
      const allItems = master?.items || [];
      const activeItems = allItems.filter((i) => i.isActive);
      const activeMasterItemIds = new Set(activeItems.map((i) => i.id));

      const inactiveItems = allItems.filter((i) => !i.isActive);
      const inactiveMasterItemIds = new Set(inactiveItems.map((i) => i.id));
      const inactiveItemsByName = new Map(inactiveItems.map((i) => [i.taskName.trim().toLowerCase(), i]));

      const existingSubTasks = checkpointCount > 0
        ? await prisma.gateSubTask.findMany({
            where: { gateId: { in: gateIds }, role },
            select: { id: true, gateId: true, role: true, taskName: true, description: true, displayOrder: true, isRequired: true, isActive: true, sourceMasterItemId: true },
          })
        : [];

      let roleCreateCount = 0;
      let roleUpdateCount = 0;
      let roleSkipCount = 0;
      let roleRemoveCount = 0;
      let rolePreserveManualCount = 0;

      // Group existing by gateId
      const gateSubTasksMap = new Map<string, typeof existingSubTasks>();
      existingSubTasks.forEach((st) => {
        const list = gateSubTasksMap.get(st.gateId) || [];
        list.push(st);
        gateSubTasksMap.set(st.gateId, list);
      });

      for (const gateId of gateIds) {
        const gateExisting = gateSubTasksMap.get(gateId) || [];
        const existingByMasterId = new Map<string, typeof existingSubTasks[0]>();
        const existingByTaskName = new Map<string, typeof existingSubTasks[0]>();

        gateExisting.forEach((st) => {
          if (st.sourceMasterItemId) {
            existingByMasterId.set(st.sourceMasterItemId, st);
          }
          existingByTaskName.set(st.taskName.trim().toLowerCase(), st);
        });

        const processedGateSubTaskIds = new Set<string>();

        for (const item of activeItems) {
          const matched = existingByMasterId.get(item.id) || existingByTaskName.get(item.taskName.trim().toLowerCase());

          if (matched) {
            processedGateSubTaskIds.add(matched.id);
            const isIdentical =
              matched.sourceMasterItemId === item.id &&
              matched.taskName === item.taskName.trim() &&
              (matched.description || '') === (item.description?.trim() || '') &&
              matched.displayOrder === item.displayOrder &&
              matched.isRequired === item.isRequired &&
              matched.isActive === true;

            if (isIdentical) {
              roleSkipCount++;
            } else {
              roleUpdateCount++;
            }
          } else {
            roleCreateCount++;
          }
        }

        // Process remaining subtasks for this gate
        for (const st of gateExisting) {
          if (processedGateSubTaskIds.has(st.id)) continue;

          const isStaleMaster =
            (st.sourceMasterItemId && !activeMasterItemIds.has(st.sourceMasterItemId)) ||
            inactiveMasterItemIds.has(st.sourceMasterItemId || '') ||
            inactiveItemsByName.has(st.taskName.trim().toLowerCase());

          if (isStaleMaster) {
            if (st.isActive) {
              roleRemoveCount++;
            }
          } else if (!st.sourceMasterItemId) {
            rolePreserveManualCount++;
          }
        }
      }

      totalCreateCount += roleCreateCount;
      totalUpdateCount += roleUpdateCount;
      totalRemoveCount += roleRemoveCount;
      totalPreserveManualCount += rolePreserveManualCount;
      totalSkipCount += roleSkipCount;

      roleResults.push({
        role,
        roleDisplay: getRoleDisplayLabel(role),
        masterTaskCount: activeItems.length,
        createCount: roleCreateCount,
        updateCount: roleUpdateCount,
        removeCount: roleRemoveCount,
        preserveManualCount: rolePreserveManualCount,
        skipCount: roleSkipCount,
      });
    }

    return {
      siteId: site.id,
      siteName: site.name,
      checkpointCount,
      roles: roleResults,
      totalCreateCount,
      totalUpdateCount,
      totalRemoveCount,
      totalPreserveManualCount,
      totalSkipCount,
    };
  }

  /**
   * Executes bulk synchronization of subtask masters to a site's checkpoints.
   * Runs in a transaction: creates new tasks, updates modified tasks,
   * soft-deactivates stale master tasks, and preserves manual checkpoint tasks.
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
        updatedTasksCount: 0,
        removedTasksCount: 0,
        preservedManualTasksCount: 0,
        skippedTasksCount: 0,
        roles: [],
      };
    }

    const gateIds = gates.map((g) => g.id);
    const selectedRoles = Array.from(new Set(roles));

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalRemoved = 0;
    let totalPreservedManual = 0;
    let totalSkipped = 0;

    const roleResults: RoleApplyPreviewResult[] = [];

    await prisma.$transaction(
      async (tx) => {
        for (const role of selectedRoles) {
          const master = await subTaskMasterRepository.findByClientAndRole(clientId, role);
          const activeItems = (master?.items || []).filter((i) => i.isActive);
          const activeMasterItemIds = new Set(activeItems.map((i) => i.id));

          const existingSubTasks = await tx.gateSubTask.findMany({
            where: { gateId: { in: gateIds }, role },
            select: {
              id: true,
              gateId: true,
              role: true,
              taskName: true,
              description: true,
              displayOrder: true,
              isRequired: true,
              isActive: true,
              sourceMasterItemId: true,
            },
          });

          // 1. Preserve Manual Tasks count
          const manualTasks = existingSubTasks.filter((st) => !st.sourceMasterItemId);
          const rolePreservedManual = manualTasks.length;

          // 2. Identify and Process Stale Master Tasks (Hybrid Deletion)
          const staleTaskIds = existingSubTasks
            .filter((st) => st.sourceMasterItemId && !activeMasterItemIds.has(st.sourceMasterItemId) && st.isActive)
            .map((st) => st.id);

          let roleRemoved = staleTaskIds.length;
          if (staleTaskIds.length > 0) {
            // Find which stale tasks have historical patrol responses
            const usedResponses = await tx.patrolSubTaskResponse.groupBy({
              by: ['gateSubTaskId'],
              where: { gateSubTaskId: { in: staleTaskIds } },
            });
            const usedTaskIds = new Set(usedResponses.map((r) => r.gateSubTaskId));

            const unusedStaleTaskIds = staleTaskIds.filter((id) => !usedTaskIds.has(id));
            const usedStaleTaskIds = staleTaskIds.filter((id) => usedTaskIds.has(id));

            // Unused stale tasks -> hard delete
            if (unusedStaleTaskIds.length > 0) {
              await tx.gateSubTask.deleteMany({
                where: { id: { in: unusedStaleTaskIds } },
              });
            }

            // Historically used stale tasks -> soft delete (archive)
            if (usedStaleTaskIds.length > 0) {
              await tx.gateSubTask.updateMany({
                where: { id: { in: usedStaleTaskIds } },
                data: { isActive: false },
              });
            }
          }

          let roleCreated = 0;
          let roleUpdated = 0;
          let roleSkipped = 0;

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

          // Group existing subtasks by gateId
          const gateSubTasksMap = new Map<string, typeof existingSubTasks>();
          existingSubTasks.forEach((st) => {
            const list = gateSubTasksMap.get(st.gateId) || [];
            list.push(st);
            gateSubTasksMap.set(st.gateId, list);
          });

          for (const gateId of gateIds) {
            const gateExisting = gateSubTasksMap.get(gateId) || [];
            const existingByMasterId = new Map<string, typeof existingSubTasks[0]>();
            const existingByTaskName = new Map<string, typeof existingSubTasks[0]>();

            gateExisting.forEach((st) => {
              if (st.sourceMasterItemId) {
                existingByMasterId.set(st.sourceMasterItemId, st);
              }
              existingByTaskName.set(st.taskName.trim().toLowerCase(), st);
            });

            for (const item of activeItems) {
              const matched = existingByMasterId.get(item.id) || existingByTaskName.get(item.taskName.trim().toLowerCase());

              if (matched) {
                const isIdentical =
                  matched.sourceMasterItemId === item.id &&
                  matched.taskName === item.taskName.trim() &&
                  (matched.description || '') === (item.description?.trim() || '') &&
                  matched.displayOrder === item.displayOrder &&
                  matched.isRequired === item.isRequired &&
                  matched.isActive === true;

                if (isIdentical) {
                  roleSkipped++;
                } else {
                  roleUpdated++;
                  await tx.gateSubTask.update({
                    where: { id: matched.id },
                    data: {
                      sourceMasterItemId: item.id,
                      taskName: item.taskName.trim(),
                      description: item.description?.trim() || null,
                      displayOrder: item.displayOrder,
                      isRequired: item.isRequired,
                      isActive: true,
                    },
                  });
                }
              } else {
                roleCreated++;
                tasksToInsert.push({
                  gateId,
                  role,
                  taskName: item.taskName.trim(),
                  description: item.description?.trim() || null,
                  displayOrder: item.displayOrder,
                  isRequired: item.isRequired,
                  isActive: true,
                  sourceMasterItemId: item.id,
                });
              }
            }
          }

          // Execute chunked insertions (500 subtask records per batch)
          const CHUNK_SIZE = 500;
          for (let i = 0; i < tasksToInsert.length; i += CHUNK_SIZE) {
            const chunk = tasksToInsert.slice(i, i + CHUNK_SIZE);
            await tx.gateSubTask.createMany({
              data: chunk,
              skipDuplicates: true,
            });
          }

          totalCreated += roleCreated;
          totalUpdated += roleUpdated;
          totalRemoved += roleRemoved;
          totalPreservedManual += rolePreservedManual;
          totalSkipped += roleSkipped;

          roleResults.push({
            role,
            roleDisplay: getRoleDisplayLabel(role),
            masterTaskCount: activeItems.length,
            createCount: roleCreated,
            updateCount: roleUpdated,
            removeCount: roleRemoved,
            preserveManualCount: rolePreservedManual,
            skipCount: roleSkipped,
          });
        }

        if (userId && clientId && (totalCreated > 0 || totalUpdated > 0 || totalRemoved > 0)) {
          await auditLogService.create({
            userId,
            clientId,
            action: 'UPDATE',
            entity: 'GateSubTask',
            entityId: site.id,
          });
        }
      },
      { timeout: 30000 }
    );

    return {
      siteId: site.id,
      siteName: site.name,
      checkpointCount,
      createdTasksCount: totalCreated,
      updatedTasksCount: totalUpdated,
      removedTasksCount: totalRemoved,
      preservedManualTasksCount: totalPreservedManual,
      skippedTasksCount: totalSkipped,
      roles: roleResults,
    };
  }
}

export const subTaskMasterService = new SubTaskMasterService();
