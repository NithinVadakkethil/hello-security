import { NextFunction, Request, Response } from 'express';

import { EmployeeStatus } from '@prisma/client';

import { HttpStatus } from '../../common/errors/HttpStatus';

import { currentUser } from '../../common/auth/current-user';

import { createEmployeeSchema, updateEmployeeSchema } from './employee.schema';
import { employeeService } from './employee.service';

export class EmployeeController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);

      const body = createEmployeeSchema.parse(req.body);

      const result = await employeeService.create(user.tenantId!, body);

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

      const status = req.query.status as EmployeeStatus | 'ALL' | undefined;

      const employees = await employeeService.list(user.tenantId!, status);

      return res.json({
        success: true,
        data: employees,
      });
    } catch (error) {
      return next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.get(req.params.id as string);

      return res.json({
        success: true,
        data: employee,
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateEmployeeSchema.parse(req.body);

      const employee = await employeeService.update(
        req.params.id as string,
        body,
      );

      return res.json({
        success: true,
        data: employee,
      });
    } catch (error) {
      return next(error);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);

      const result = await employeeService.deactivate(id);

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
      const id = String(req.params.id);

      const result = await employeeService.activate(id);

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
      await employeeService.delete(req.params.id as string);

      return res.json({
        success: true,
        message: 'Employee deleted successfully.',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const employeeController = new EmployeeController();
