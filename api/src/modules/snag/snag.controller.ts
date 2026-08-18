import { Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { addSnagCommentSchema, assignSnagSchema, completeSnagSchema, createSnagSchema, updateSnagStatusSchema, verifyQrSchema } from './snag.schema';
import { snagService } from './snag.service';
import { resolveEmployeeId } from '../../common/auth/resolve-employee';

export class SnagController {
  async create(req: Request, res: Response) {
    const user = currentUser(req);
    const validated = createSnagSchema.parse(req.body);
    const clientId = user.tenantId!;
    const employeeId = await resolveEmployeeId(user);
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
    const { siteId, gateId, patrolSessionId, employeeId, assignedToId, assignedToMe, status, priority, category, subCategory, search, startDate, endDate, page, limit } = req.query;

    const filterAssignedTo = assignedToMe === 'true' ? user.id : (assignedToId as string);

    const result = await snagService.list(
      clientId,
      {
        siteId: siteId as string,
        gateId: gateId as string,
        patrolSessionId: patrolSessionId as string,
        employeeId: employeeId as string,
        assignedToId: filterAssignedTo,
        status: status as string,
        priority: priority as string,
        category: category as string,
        subCategory: subCategory as string,
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      },
      user.id,
      user.role
    );

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

    const snag = await snagService.get(id, clientId, user.id, user.role);

    res.json({
      success: true,
      data: snag,
    });
  }

  async verifyQr(req: Request, res: Response) {
    const user = currentUser(req);
    const validated = verifyQrSchema.parse(req.body);
    const clientId = user.tenantId!;
    const id = req.params.id as string;

    const result = await snagService.verifyCheckpointQr(id, clientId, user.id, user.role, validated.qrCode);

    res.json({
      success: true,
      message: 'Checkpoint QR verified successfully',
      data: result,
    });
  }

  async completeJob(req: Request, res: Response) {
    const user = currentUser(req);
    const validated = completeSnagSchema.parse(req.body);
    const clientId = user.tenantId!;
    const id = req.params.id as string;

    const updated = await snagService.completeJob(id, clientId, user.id, user.role, validated);

    res.json({
      success: true,
      message: 'Maintenance job completed successfully',
      data: updated,
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
