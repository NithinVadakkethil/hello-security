import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';
import { logger } from '../logger/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      error: {
        code: ErrorCodes.UNAUTHORIZED,
        message: err.name === 'TokenExpiredError' ? 'Access token has expired.' : 'Invalid access token.',
      },
    });
  }

  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
    },
    'Unhandled exception',
  );

  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: ErrorCodes.UNKNOWN_ERROR,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message,
    },
  });
}
