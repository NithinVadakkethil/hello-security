import { Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { addSnagCommentSchema, assignSnagSchema, createSnagSchema, updateSnagStatusSchema } from './snag.schema';
import { snagService } from './snag.service';

export class SnagController {
  async create(req: Request, res: Response) {
    const user = currentUser(req);
    const validated = createSnagSchema.parse(req.body);
    const clientId = user.tenantId!;
    const employeeId = user.employeeId!;
    const userId = user.id;

    const snag = await snagService.create(clientId, employeeId, userId, validated);

    res.status(201).json({
      success: true,
      message: 'Snag reported successfully',
      data: snag,
    });
  }

  async list(req: Request, res: Response) {
    const user = currentUser(req);
    const clientId = user.tenantId!;
    const { siteId, gateId, patrolSessionId, employeeId, status, priority, category, subCategory, search, startDate, endDate, page, limit } = req.query;

    const result = await snagService.list(clientId, {
      siteId: siteId as string,
      gateId: gateId as string,
      patrolSessionId: patrolSessionId as string,
      employeeId: employeeId as string,
      status: status as string,
      priority: priority as string,
      category: category as string,
      subCategory: subCategory as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });

    res.json({
      success: true,
      data: result.snags,
      pagination: result.pagination,
    });
  }

  async getStats(req: Request, res: Response) {
    const user = currentUser(req);
    const clientId = user.tenantId!;

    const stats = await snagService.getStats(clientId);

    res.json({
      success: true,
      data: stats,
    });
  }

  async get(req: Request, res: Response) {
    const user = currentUser(req);
    const clientId = user.tenantId!;
    const id = req.params.id as string;

    const snag = await snagService.get(id, clientId);

    res.json({
      success: true,
      data: snag,
    });
  }

  async updateStatus(req: Request, res: Response) {
    const user = currentUser(req);
    const validated = updateSnagStatusSchema.parse(req.body);
    const clientId = user.tenantId!;
    const userId = user.id;
    const id = req.params.id as string;

    const updated = await snagService.updateStatus(id, clientId, userId, validated);

    res.json({
      success: true,
      message: 'Snag status updated',
      data: updated,
    });
  }

  async addComment(req: Request, res: Response) {
    const user = currentUser(req);
    const validated = addSnagCommentSchema.parse(req.body);
    const clientId = user.tenantId!;
    const userId = user.id;
    const id = req.params.id as string;

    const comment = await snagService.addComment(id, clientId, userId, validated);

    res.status(201).json({
      success: true,
      message: 'Comment added',
      data: comment,
    });
  }

  async assign(req: Request, res: Response) {
    const user = currentUser(req);
    const validated = assignSnagSchema.parse(req.body);
    const clientId = user.tenantId!;
    const userId = user.id;
    const id = req.params.id as string;

    const assignment = await snagService.assign(id, clientId, userId, validated);

    res.status(201).json({
      success: true,
      message: 'Maintenance assigned',
      data: assignment,
    });
  }
}

export const snagController = new SnagController();
