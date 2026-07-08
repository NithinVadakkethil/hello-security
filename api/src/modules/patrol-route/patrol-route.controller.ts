import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import {
  createPatrolRouteSchema,
  updatePatrolRouteSchema,
} from './patrol-route.schema';
import { patrolRouteService } from './patrol-route.service';

export class PatrolRouteController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);

      const body = createPatrolRouteSchema.parse(req.body);

      const result = await patrolRouteService.create(user.tenantId!, body);

      return res.status(HttpStatus.CREATED).json({
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

      const isActive =
        req.query.isActive === undefined
          ? undefined
          : req.query.isActive === 'true';

      const routes = await patrolRouteService.list(user.tenantId!, isActive);

      return res.json({
        success: true,
        data: routes,
      });
    } catch (error) {
      return next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patrolRouteService.get(req.params.id as string);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updatePatrolRouteSchema.parse(req.body);

      const result = await patrolRouteService.update(
        req.params.id as string,
        body,
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patrolRouteService.activate(req.params.id as string);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patrolRouteService.deactivate(
        req.params.id as string,
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

export const patrolRouteController = new PatrolRouteController();
