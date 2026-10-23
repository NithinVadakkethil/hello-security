import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';
import { isApiFeatureEnabled, ApiFeatureKey } from '../../config/feature-profile';

/**
 * Middleware to enforce backend feature flags.
 * If the requested module is disabled in the active profile, responds with 403 Forbidden.
 */
export function requireFeature(featureKey: ApiFeatureKey) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!isApiFeatureEnabled(featureKey)) {
      return next(
        new AppError(
          HttpStatus.FORBIDDEN,
          ErrorCodes.FORBIDDEN,
          `The '${featureKey}' feature is disabled in this environment.`,
        ),
      );
    }
    next();
  };
}
