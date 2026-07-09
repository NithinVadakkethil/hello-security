import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { completePatrolSchema } from './patrol-session.schema';
import { patrolSessionService } from './patrol-session.service';

export class PatrolSessionController {
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);

      const result = await patrolSessionService.start(
        user.tenantId!,
        user.employeeId!,
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

      const result = await patrolSessionService.current(user.employeeId!);

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

      const result = await patrolSessionService.history(user.tenantId!);

      return res.json({
        success: true,
        data: result,
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
}

export const patrolSessionController = new PatrolSessionController();
