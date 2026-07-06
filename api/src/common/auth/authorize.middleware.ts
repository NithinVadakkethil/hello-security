import { UserRole } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new AppError(
          HttpStatus.UNAUTHORIZED,
          ErrorCodes.UNAUTHORIZED,
          'Authentication required.',
        ),
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          'You are not authorized to perform this action.',
        ),
      );
    }

    next();
  };
}
