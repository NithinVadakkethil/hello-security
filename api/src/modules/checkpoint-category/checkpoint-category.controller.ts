import { Request, Response } from 'express';
import {
  createCategorySubTaskSchema,
  createCheckpointCategorySchema,
  reorderCategorySubTasksSchema,
  updateCategorySubTaskSchema,
  updateCheckpointCategorySchema,
} from './checkpoint-category.schema';
import { checkpointCategoryService } from './checkpoint-category.service';
import { AppError } from '../../common/errors/AppError';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { ErrorCodes } from '../../common/errors/ErrorCodes';

export class CheckpointCategoryController {
  private getClientId(req: Request): string {
    const user = (req as any).user;
    const clientId = user?.clientId || user?.tenantId || (req.query?.clientId as string) || (req.headers['x-client-id'] as string);
    if (!clientId) {
      throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, 'Client context is required.');
    }
    return clientId;
  }

  async list(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    const clientId = user?.clientId || user?.tenantId || (req.query?.clientId as string) || (req.headers['x-client-id'] as string);
    if (!clientId) {
      res.json({ success: true, data: [] });
      return;
    }
    const categories = await checkpointCategoryService.list(clientId);
    res.json({
      success: true,
      data: categories,
    });
  }

  async getById(req: Request, res: Response) {
    const clientId = this.getClientId(req);
    const id = req.params.id as string;
    const category = await checkpointCategoryService.getById(clientId, id);
    res.json({
      success: true,
      data: category,
    });
  }

  async create(req: Request, res: Response) {
    const clientId = this.getClientId(req);
    const userId = (req as any).user?.id;
    const body = createCheckpointCategorySchema.parse(req.body);

    const created = await checkpointCategoryService.create(clientId, body, userId);
    res.status(201).json({
      success: true,
      message: 'Checkpoint category created successfully.',
      data: created,
    });
  }

  async update(req: Request, res: Response) {
    const clientId = this.getClientId(req);
    const userId = (req as any).user?.id;
    const id = req.params.id as string;
    const body = updateCheckpointCategorySchema.parse(req.body);

    const updated = await checkpointCategoryService.update(clientId, id, body, userId);
    res.json({
      success: true,
      message: 'Checkpoint category updated successfully.',
      data: updated,
    });
  }

  async delete(req: Request, res: Response) {
    const clientId = this.getClientId(req);
    const userId = (req as any).user?.id;
    const id = req.params.id as string;

    const result = await checkpointCategoryService.delete(clientId, id, userId);
    res.json({
      success: true,
      message: 'Checkpoint category deleted successfully.',
      data: result,
    });
  }

  // --- SubTasks Management ---

  async createSubTask(req: Request, res: Response) {
    const clientId = this.getClientId(req);
    const userId = (req as any).user?.id;
    const categoryId = req.params.id as string;
    const body = createCategorySubTaskSchema.parse(req.body);

    const subTask = await checkpointCategoryService.createSubTask(clientId, categoryId, body, userId);
    res.status(201).json({
      success: true,
      message: 'Category sub-task created successfully.',
      data: subTask,
    });
  }

  async updateSubTask(req: Request, res: Response) {
    const clientId = this.getClientId(req);
    const userId = (req as any).user?.id;
    const categoryId = req.params.id as string;
    const subTaskId = req.params.subTaskId as string;
    const body = updateCategorySubTaskSchema.parse(req.body);

    const subTask = await checkpointCategoryService.updateSubTask(clientId, categoryId, subTaskId, body, userId);
    res.json({
      success: true,
      message: 'Category sub-task updated successfully.',
      data: subTask,
    });
  }

  async deleteSubTask(req: Request, res: Response) {
    const clientId = this.getClientId(req);
    const userId = (req as any).user?.id;
    const categoryId = req.params.id as string;
    const subTaskId = req.params.subTaskId as string;

    const result = await checkpointCategoryService.deleteSubTask(clientId, categoryId, subTaskId, userId);
    res.json({
      success: true,
      message: 'Category sub-task deleted successfully.',
      data: result,
    });
  }

  async reorderSubTasks(req: Request, res: Response) {
    const clientId = this.getClientId(req);
    const userId = (req as any).user?.id;
    const categoryId = req.params.id as string;
    const body = reorderCategorySubTasksSchema.parse(req.body);

    const updated = await checkpointCategoryService.reorderSubTasks(clientId, categoryId, body, userId);
    res.json({
      success: true,
      message: 'Category sub-tasks reordered successfully.',
      data: updated,
    });
  }

  // --- Demo Cleanup: Delete All Subtasks ---

  async deleteAllSubTasks(req: Request, res: Response) {
    const clientId = this.getClientId(req);
    const userId = (req as any).user?.id;

    const result = await checkpointCategoryService.deleteAllSubTasks(clientId, userId);
    res.json({
      success: true,
      message: result.message,
      deletedCount: result.deletedCount,
      totalDeleted: result.totalDeleted,
      data: result,
    });
  }
}

export const checkpointCategoryController = new CheckpointCategoryController();
