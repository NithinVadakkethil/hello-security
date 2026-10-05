import { UserRole } from '@prisma/client';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { auditLogService } from '../audit-log/audit-log.service';
import { checkpointCategoryRepository } from './checkpoint-category.repository';
import {
  CreateCategorySubTaskDto,
  CreateCheckpointCategoryDto,
  ReorderCategorySubTasksDto,
  UpdateCategorySubTaskDto,
  UpdateCheckpointCategoryDto,
} from './checkpoint-category.types';

export class CheckpointCategoryService {
  async list(clientId: string) {
    const categories = await checkpointCategoryRepository.listByClient(clientId);

    return categories.map((cat) => {
      const subTasksByRole: Record<string, number> = {};
      for (const st of cat.subTasks) {
        subTasksByRole[st.role] = (subTasksByRole[st.role] || 0) + 1;
      }

      return {
        id: cat.id,
        clientId: cat.clientId,
        name: cat.name,
        normalizedName: cat.normalizedName,
        description: cat.description,
        checkpointsCount: cat._count.gates,
        subTasksCount: cat._count.subTasks,
        subTasksByRole,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      };
    });
  }

  async getById(clientId: string, id: string) {
    const category = await checkpointCategoryRepository.findById(id);
    if (!category || category.clientId !== clientId) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Checkpoint category not found.');
    }
    return category;
  }

  async create(clientId: string, dto: CreateCheckpointCategoryDto, userId?: string) {
    const name = dto.name.trim();
    const normalizedName = name.toLowerCase();

    const existing = await checkpointCategoryRepository.findByNormalizedName(clientId, normalizedName);
    if (existing) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        `Category "${name}" already exists. Please select it from the category list.`
      );
    }

    const created = await checkpointCategoryRepository.create({
      clientId,
      name,
      normalizedName,
      description: dto.description?.trim() || null,
    });

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'CREATE',
        entity: 'CheckpointCategory',
        entityId: created.id,
      });
    }

    return created;
  }

  async update(clientId: string, id: string, dto: UpdateCheckpointCategoryDto, userId?: string) {
    const category = await this.getById(clientId, id);

    let normalizedName: string | undefined;
    let name = dto.name?.trim();

    if (name && name.toLowerCase() !== category.normalizedName) {
      normalizedName = name.toLowerCase();
      const existing = await checkpointCategoryRepository.findByNormalizedName(clientId, normalizedName);
      if (existing && existing.id !== id) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          `Category "${name}" already exists. Please choose a different name.`
        );
      }
    }

    const updated = await checkpointCategoryRepository.update(id, {
      name,
      normalizedName,
      description: dto.description !== undefined ? (dto.description?.trim() || null) : undefined,
    });

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'UPDATE',
        entity: 'CheckpointCategory',
        entityId: updated.id,
      });
    }

    return updated;
  }

  async delete(clientId: string, id: string, userId?: string) {
    await this.getById(clientId, id);

    const assignedGatesCount = await checkpointCategoryRepository.countAssignedGates(id);
    if (assignedGatesCount > 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        `This category is currently assigned to ${assignedGatesCount} checkpoint(s). Reassign those checkpoints to another category before deleting it.`
      );
    }

    await checkpointCategoryRepository.delete(id);

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'DELETE',
        entity: 'CheckpointCategory',
        entityId: id,
      });
    }

    return { success: true, id };
  }

  // --- SubTasks Management ---

  async createSubTask(clientId: string, categoryId: string, dto: CreateCategorySubTaskDto, userId?: string) {
    await this.getById(clientId, categoryId);

    const role = dto.role || UserRole.SECURITY;
    const taskName = dto.taskName.trim();

    const existing = await checkpointCategoryRepository.findSubTaskByNameAndRole(categoryId, role, taskName);
    if (existing) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        `A sub-task named "${taskName}" already exists for role ${role} in this category.`
      );
    }

    const subTask = await checkpointCategoryRepository.createSubTask(categoryId, {
      ...dto,
      role,
      taskName,
    });

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'CREATE',
        entity: 'CategorySubTask',
        entityId: subTask.id,
      });
    }

    return subTask;
  }

  async updateSubTask(clientId: string, categoryId: string, subTaskId: string, dto: UpdateCategorySubTaskDto, userId?: string) {
    await this.getById(clientId, categoryId);
    const subTask = await checkpointCategoryRepository.findSubTaskById(subTaskId);
    if (!subTask || subTask.categoryId !== categoryId) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Sub-task not found.');
    }

    const targetRole = dto.role || subTask.role;
    const targetTaskName = dto.taskName ? dto.taskName.trim() : subTask.taskName;

    if (
      (dto.taskName && targetTaskName.toLowerCase() !== subTask.taskName.toLowerCase()) ||
      (dto.role && targetRole !== subTask.role)
    ) {
      const existing = await checkpointCategoryRepository.findSubTaskByNameAndRole(categoryId, targetRole, targetTaskName);
      if (existing && existing.id !== subTaskId) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          `A sub-task named "${targetTaskName}" already exists for role ${targetRole} in this category.`
        );
      }
    }

    const updated = await checkpointCategoryRepository.updateSubTask(subTaskId, dto);

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'UPDATE',
        entity: 'CategorySubTask',
        entityId: updated.id,
      });
    }

    return updated;
  }

  async deleteSubTask(clientId: string, categoryId: string, subTaskId: string, userId?: string) {
    await this.getById(clientId, categoryId);
    const subTask = await checkpointCategoryRepository.findSubTaskById(subTaskId);
    if (!subTask || subTask.categoryId !== categoryId) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Sub-task not found.');
    }

    await checkpointCategoryRepository.deleteSubTask(subTaskId);

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'DELETE',
        entity: 'CategorySubTask',
        entityId: subTaskId,
      });
    }

    return { success: true, id: subTaskId };
  }

  async reorderSubTasks(clientId: string, categoryId: string, dto: ReorderCategorySubTasksDto, userId?: string) {
    await this.getById(clientId, categoryId);

    const updated = await checkpointCategoryRepository.reorderSubTasks(dto.subTasks);

    if (userId && clientId && dto.subTasks.length > 0) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'UPDATE',
        entity: 'CategorySubTask',
        entityId: dto.subTasks[0].id,
      });
    }

    return updated;
  }

  /**
   * Delete All Subtasks (Demo cleanup feature):
   * Removes all configured checkpoint subtasks for this client, preserving categories, checkpoints and QR codes.
   */
  async deleteAllSubTasks(clientId: string, userId?: string) {
    const result = await checkpointCategoryRepository.deleteAllSubTasksForClient(clientId);

    if (userId && clientId) {
      await auditLogService.create({
        userId,
        clientId,
        action: 'DELETE',
        entity: 'SubTaskConfiguration',
        entityId: clientId,
      });
    }

    return {
      success: true,
      message: 'All configured checkpoint subtasks deleted successfully.',
      deletedCategorySubTasksCount: result.deletedCategorySubTasksCount,
      deletedGateSubTasksCount: result.deletedGateSubTasksCount,
      deletedSubTaskMasterItemsCount: result.deletedSubTaskMasterItemsCount,
      deletedSubTaskMastersCount: result.deletedSubTaskMastersCount,
      deletedCount: result.deletedCount,
      totalDeleted: result.totalDeleted,
    };
  }
}

export const checkpointCategoryService = new CheckpointCategoryService();
