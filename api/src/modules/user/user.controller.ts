import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { userService } from './user.service';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';

export class UserController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 10);
      const search = req.query.search as string | undefined;
      const role = req.query.role as string | undefined;

      const currentUser = req.user as any;
      let clientId = req.query.clientId as string | undefined;

      // Restrict CLIENT_ADMIN to only their client's users
      if (currentUser.role === UserRole.CLIENT_ADMIN) {
        clientId = currentUser.tenantId;
      }

      const result = await userService.list(page, limit, search, role, clientId);
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
      const currentUser = req.user as any;
      const user = await userService.getById(req.params.id as string);

      // Restrict CLIENT_ADMIN to users within their client
      if (currentUser.role === UserRole.CLIENT_ADMIN && user.clientId !== currentUser.tenantId) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'Access denied to this user.',
        );
      }

      return res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = req.user as any;
      const body = req.body;

      // CLIENT_ADMIN can only create users for their own client
      if (currentUser.role === UserRole.CLIENT_ADMIN) {
        body.clientId = currentUser.tenantId;
        // CLIENT_ADMIN cannot create SUPER_ADMINs
        if (body.role === UserRole.SUPER_ADMIN) {
          throw new AppError(
            HttpStatus.FORBIDDEN,
            ErrorCodes.FORBIDDEN,
            'Cannot create Super Admin user.',
          );
        }
      }

      const result = await userService.create(body);
      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = req.user as any;
      const user = await userService.getById(req.params.id as string);

      if (currentUser.role === UserRole.CLIENT_ADMIN && user.clientId !== currentUser.tenantId) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'Access denied.',
        );
      }

      const result = await userService.update(req.params.id as string, req.body);
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
      const currentUser = req.user as any;
      const user = await userService.getById(req.params.id as string);

      if (currentUser.role === UserRole.CLIENT_ADMIN && user.clientId !== currentUser.tenantId) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'Access denied.',
        );
      }

      const result = await userService.setStatus(req.params.id as string, true);
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
      const currentUser = req.user as any;
      const user = await userService.getById(req.params.id as string);

      if (currentUser.role === UserRole.CLIENT_ADMIN && user.clientId !== currentUser.tenantId) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'Access denied.',
        );
      }

      const result = await userService.setStatus(req.params.id as string, false);
      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = req.user as any;
      const user = await userService.getById(req.params.id as string);

      if (currentUser.role === UserRole.CLIENT_ADMIN && user.clientId !== currentUser.tenantId) {
        throw new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'Access denied.',
        );
      }

      const result = await userService.resetPassword(req.params.id as string, req.body.newPassword);
      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const userController = new UserController();
