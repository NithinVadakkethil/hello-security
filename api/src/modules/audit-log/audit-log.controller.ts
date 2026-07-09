import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { auditLogService } from './audit-log.service';

export class AuditLogController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 10);
      const search = req.query.search as string | undefined;
      const action = req.query.action as string | undefined;
      const entity = req.query.entity as string | undefined;
      const userId = req.query.userId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const currentUser = req.user as any;
      let clientId = req.query.clientId as string | undefined;

      // Restrict CLIENT_ADMIN to only their client logs
      if (currentUser.role === UserRole.CLIENT_ADMIN) {
        clientId = currentUser.tenantId;
      }

      const result = await auditLogService.list(
        page,
        limit,
        search,
        action,
        entity,
        userId,
        clientId,
        startDate,
        endDate,
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const auditLogController = new AuditLogController();
