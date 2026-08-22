import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { createGateSchema, updateGateSchema } from './gate.schema';
import { gateService } from './gate.service';

export class GateController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      currentUser(req); // Authentication + authorization already handled

      const body = createGateSchema.parse(req.body);

      const result = await gateService.create(body);

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
      const siteId = req.query.siteId as string | undefined;

      const isActive =
        req.query.isActive === undefined
          ? undefined
          : req.query.isActive === 'true';

      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const search = req.query.search as string | undefined;

      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const clientId = isSuperAdmin || !user.tenantId ? undefined : user.tenantId;

      const result = await gateService.list(siteId, isActive, clientId, page, limit, search);

      if (Array.isArray(result)) {
        return res.status(HttpStatus.OK).json({
          success: true,
          data: result,
        });
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getNextSequence(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.query.siteId as string;

      const result = await gateService.getNextSequence(siteId);

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await gateService.get(req.params.id as string);

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
      const body = updateGateSchema.parse(req.body);

      const result = await gateService.update(req.params.id as string, body);

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
      const result = await gateService.activate(req.params.id as string);

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
      const result = await gateService.deactivate(req.params.id as string);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const gateController = new GateController();
