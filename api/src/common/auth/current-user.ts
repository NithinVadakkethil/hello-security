/* eslint-disable @typescript-eslint/no-namespace */
import { UserRole } from '@prisma/client';
import { Request } from 'express';

import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';

export interface CurrentUser {
  id: string;
  tenantId: string | null;
  employeeId: string | null;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

export function currentUser(req: Request) {
  if (!req.user) {
    throw new AppError(
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
      'Unauthorized',
    );
  }

  return req.user;
}
