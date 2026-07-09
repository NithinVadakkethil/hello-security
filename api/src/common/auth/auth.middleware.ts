import { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';
import { verifyAccessToken } from './jwt';

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Authorization header missing.',
      );
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Invalid authorization header.',
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      employeeId: payload.employeeId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}
