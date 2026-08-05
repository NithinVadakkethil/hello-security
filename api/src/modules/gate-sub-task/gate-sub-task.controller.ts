import { Request, Response } from 'express';
import { createGateSubTaskSchema, updateGateSubTaskSchema, reorderGateSubTasksSchema } from './gate-sub-task.schema';
import { gateSubTaskService } from './gate-sub-task.service';

export class GateSubTaskController {
  async create(req: Request, res: Response) {
    const gateId = req.params.gateId as string;
    const body = createGateSubTaskSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const clientId = (req as any).user?.clientId;

    const subTask = await gateSubTaskService.create(gateId, body, userId, clientId);

    res.status(201).json({
      success: true,
      message: 'Gate sub-task created successfully.',
      data: subTask,
    });
  }

  async list(req: Request, res: Response) {
    const gateId = req.params.gateId as string;
    const onlyActive = req.query.onlyActive === 'true';
    const role = req.query.role as any;

    const subTasks = await gateSubTaskService.list(gateId, onlyActive, role);

    res.json({
      success: true,
      data: subTasks,
    });
  }

  async get(req: Request, res: Response) {
    const id = req.params.id as string;
    const subTask = await gateSubTaskService.get(id);

    res.json({
      success: true,
      data: subTask,
    });
  }

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const body = updateGateSubTaskSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const clientId = (req as any).user?.clientId;

    const subTask = await gateSubTaskService.update(id, body, userId, clientId);

    res.json({
      success: true,
      message: 'Gate sub-task updated successfully.',
      data: subTask,
    });
  }

  async delete(req: Request, res: Response) {
    const id = req.params.id as string;
    const userId = (req as any).user?.id;
    const clientId = (req as any).user?.clientId;

    await gateSubTaskService.delete(id, userId, clientId);

    res.json({
      success: true,
      message: 'Gate sub-task deleted successfully.',
    });
  }

  async reorder(req: Request, res: Response) {
    const gateId = req.params.gateId as string;
    const body = reorderGateSubTasksSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const clientId = (req as any).user?.clientId;

    const subTasks = await gateSubTaskService.reorder(gateId, body, userId, clientId);

    res.json({
      success: true,
      message: 'Gate sub-tasks reordered successfully.',
      data: subTasks,
    });
  }
}

export const gateSubTaskController = new GateSubTaskController();
