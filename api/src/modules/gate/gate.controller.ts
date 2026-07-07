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
      const siteId = req.query.siteId as string;

      if (!siteId) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'siteId is required.',
        });
      }

      const isActive =
        req.query.isActive === undefined
          ? undefined
          : req.query.isActive === 'true';

      const result = await gateService.list(siteId, isActive);

      return res.json({
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
