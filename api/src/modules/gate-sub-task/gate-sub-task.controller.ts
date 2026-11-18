import { Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { createGateSubTaskSchema, updateGateSubTaskSchema, reorderGateSubTasksSchema } from './gate-sub-task.schema';
import { gateSubTaskService } from './gate-sub-task.service';

export class GateSubTaskController {
  async create(req: Request, res: Response) {
    const user = currentUser(req);
    const gateId = req.params.gateId as string;
    const body = createGateSubTaskSchema.parse(req.body);

    const subTask = await gateSubTaskService.create(
      gateId,
      body,
      user.id,
      user.tenantId || undefined,
      user,
    );

    res.status(201).json({
      success: true,
      message: 'Gate sub-task created successfully.',
      data: subTask,
    });
  }

  async list(req: Request, res: Response) {
    const user = currentUser(req);
    const gateId = req.params.gateId as string;
    const onlyActive = req.query.onlyActive !== 'false';
    const role = req.query.role as any;

    const subTasks = await gateSubTaskService.list(gateId, onlyActive, role, user);

    res.json({
      success: true,
      data: subTasks,
    });
  }

  async get(req: Request, res: Response) {
    const user = currentUser(req);
    const id = req.params.id as string;
    const subTask = await gateSubTaskService.get(id, user);

    res.json({
      success: true,
      data: subTask,
    });
  }

  async update(req: Request, res: Response) {
    const user = currentUser(req);
    const id = req.params.id as string;
    const body = updateGateSubTaskSchema.parse(req.body);

    const subTask = await gateSubTaskService.update(
      id,
      body,
      user.id,
      user.tenantId || undefined,
      user,
    );

    res.json({
      success: true,
      message: 'Gate sub-task updated successfully.',
      data: subTask,
    });
  }

  async delete(req: Request, res: Response) {
    const user = currentUser(req);
    const id = req.params.id as string;

    await gateSubTaskService.delete(id, user.id, user.tenantId || undefined, user);

    res.json({
      success: true,
      message: 'Gate sub-task deleted successfully.',
    });
  }

  async reorder(req: Request, res: Response) {
    const user = currentUser(req);
    const gateId = req.params.gateId as string;
    const body = reorderGateSubTasksSchema.parse(req.body);

    const subTasks = await gateSubTaskService.reorder(
      gateId,
      body,
      user.id,
      user.tenantId || undefined,
      user,
    );

    res.json({
      success: true,
      message: 'Gate sub-tasks reordered successfully.',
      data: subTasks,
    });
  }
}

export const gateSubTaskController = new GateSubTaskController();
