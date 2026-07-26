import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from './assignment.schema';
import { assignmentService } from './assignment.service';

export class AssignmentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);

      const body = createAssignmentSchema.parse(req.body);

      const result = await assignmentService.create(user.tenantId!, body);

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

      const result = await assignmentService.list(user.tenantId!, isActive);

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
      const result = await assignmentService.get(req.params.id as string);

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
      const body = updateAssignmentSchema.parse(req.body);

      const result = await assignmentService.update(
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
      const result = await assignmentService.activate(req.params.id as string);

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
      const result = await assignmentService.deactivate(
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

  async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const result = await assignmentService.getActive(user.employeeId!);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getActiveList(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const result = await assignmentService.getActiveList(user.employeeId!);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getMyAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const result = await assignmentService.getEmployeeAllAssignments(user.employeeId!);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const assignmentController = new AssignmentController();
