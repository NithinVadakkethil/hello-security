//JWT

import { UserRole } from '@prisma/client';
import jwt, { SignOptions } from 'jsonwebtoken';

import { appConfig } from '../../config/app.config';

export interface JwtPayload {
  sub: string;
  tenantId: string | null;
  employeeId: string | null;
  email: string;
  role: UserRole;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, appConfig.jwt.accessSecret, {
    expiresIn: appConfig.jwt.accessExpiresIn as SignOptions['expiresIn'],
    issuer: appConfig.jwt.issuer,
    audience: appConfig.jwt.audience,
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, appConfig.jwt.refreshSecret, {
    expiresIn: appConfig.jwt.refreshExpiresIn as SignOptions['expiresIn'],
    issuer: appConfig.jwt.issuer,
    audience: appConfig.jwt.audience,
  });
}

import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, appConfig.jwt.accessSecret, {
      issuer: appConfig.jwt.issuer,
      audience: appConfig.jwt.audience,
    }) as JwtPayload;
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Access token has expired.',
      );
    }
    if (error?.name === 'JsonWebTokenError') {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Invalid access token.',
      );
    }
    throw error;
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, appConfig.jwt.refreshSecret, {
      issuer: appConfig.jwt.issuer,
      audience: appConfig.jwt.audience,
    }) as JwtPayload;
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Refresh token has expired.',
      );
    }
    if (error?.name === 'JsonWebTokenError') {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Invalid refresh token.',
      );
    }
    throw error;
  }
}
