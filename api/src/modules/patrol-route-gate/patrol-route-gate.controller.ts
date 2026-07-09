import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import {
  createPatrolRouteGateSchema,
  updatePatrolRouteGateSchema,
} from './patrol-route-gate.schema';

import { patrolRouteGateService } from './patrol-route-gate.service';

export class PatrolRouteGateController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      currentUser(req);

      const body = createPatrolRouteGateSchema.parse(req.body);

      const result = await patrolRouteGateService.create(
        req.params.routeId as string,
        body,
      );

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
      currentUser(req);

      const result = await patrolRouteGateService.list(
        req.params.routeId as string,
      );

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
      currentUser(req);

      const body = updatePatrolRouteGateSchema.parse(req.body);

      const result = await patrolRouteGateService.update(
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

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      currentUser(req);

      const result = await patrolRouteGateService.delete(
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

export const patrolRouteGateController = new PatrolRouteGateController();
