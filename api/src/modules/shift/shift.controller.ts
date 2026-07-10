import { NextFunction, Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { createShiftSchema, updateShiftSchema } from './shift.schema';
import { shiftService } from './shift.service';

export class ShiftController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const body = createShiftSchema.parse(req.body);
      const result = await shiftService.create(user.tenantId!, body);
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
      const result = await shiftService.list(user.tenantId!, isActive);
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
      const result = await shiftService.get(req.params.id as string);
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
      const body = updateShiftSchema.parse(req.body);
      const result = await shiftService.update(req.params.id as string, body);
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
      const result = await shiftService.activate(req.params.id as string);
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
      const result = await shiftService.deactivate(req.params.id as string);
      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const shiftController = new ShiftController();
