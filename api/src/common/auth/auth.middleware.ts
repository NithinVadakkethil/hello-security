import { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';
import { verifyAccessToken } from './jwt';
import { prisma } from '../../database/prisma';
import { isSiraExpired, isSiraRequiredForRole } from '../utils/sira-expiry.util';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
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
      supervisedRole: payload.supervisedRole || null,
    };

    if (req.user && isSiraRequiredForRole(req.user.role) && req.user.employeeId) {
      const path = req.originalUrl || req.path || '';
      const isAllowedPath =
        path.includes('/auth/me') ||
        path.includes('/auth/logout') ||
        path.includes('/auth/refresh') ||
        path.includes('/auth/change-password') ||
        path.includes('/health');

      if (!isAllowedPath) {
        const employee = await prisma.employee.findUnique({
          where: { id: req.user.employeeId },
          select: { role: true, siraCardExpiryDate: true },
        });

        if (isSiraExpired(employee)) {
          throw new AppError(
            HttpStatus.FORBIDDEN,
            ErrorCodes.SIRA_CARD_EXPIRED,
            'Your SIRA card has expired. Please renew your SIRA card with your administrator.',
          );
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}
