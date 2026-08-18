import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { resolveEmployeeId } from '../../common/auth/resolve-employee';

import { completePatrolSchema } from './patrol-session.schema';
import { patrolSessionService } from './patrol-session.service';

export class PatrolSessionController {
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const employeeId = await resolveEmployeeId(user);
      const assignmentId = req.body?.assignmentId || (req.query?.assignmentId as string | undefined);

      const result = await patrolSessionService.start(
        user.tenantId!,
        employeeId,
        assignmentId,
      );

      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async current(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const employeeId = await resolveEmployeeId(user);

      const result = await patrolSessionService.current(employeeId);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async history(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const { page, limit, search, status, tab, filter, siteId, employeeId } = req.query;

      const result = await patrolSessionService.history(user.tenantId!, {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
        search: search as string,
        status: status as string,
        tab: tab as string,
        filter: filter as string,
        siteId: siteId as string,
        employeeId: employeeId as string,
      });

      return res.json({
        success: true,
        data: result.sessions,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patrolSessionService.pause(req.params.id as string);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patrolSessionService.resume(req.params.id as string);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const body = completePatrolSchema.parse(req.body);

      const result = await patrolSessionService.complete(
        req.params.id as string,
        body.remarks,
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const { page, limit, search, status, tab, filter, siteId, employeeId } = req.query;

      const result = await patrolSessionService.history(user.tenantId!, {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
        search: search as string,
        status: status as string,
        tab: tab as string,
        filter: filter as string,
        siteId: siteId as string,
        employeeId: employeeId as string,
      });

      return res.json({
        success: true,
        data: result.sessions,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patrolSessionService.findById(req.params.id as string);

      if (!result) {
        return res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          message: 'Patrol session not found.',
        });
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const { verificationStatus, supervisorRemarks } = req.body;

      const result = await patrolSessionService.verify(
        req.params.id as string,
        user.id,
        {
          verificationStatus,
          supervisorRemarks,
        },
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patrolSessionService.cancel(req.params.id as string);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const patrolSessionController = new PatrolSessionController();
