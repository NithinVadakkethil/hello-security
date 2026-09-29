import { NextFunction, Request, Response } from 'express';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { currentUser } from '../../common/auth/current-user';
import { faceEnrollmentService } from './face-enrollment.service';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';

export class FaceEnrollmentController {
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const user = currentUser(req);
      if (!user.employeeId) {
        throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'User does not have an associated employee profile.');
      }

      const result = await faceEnrollmentService.getStatus(user.employeeId);
      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async registerFace(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const user = currentUser(req);
      if (!user.employeeId || !user.tenantId) {
        throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'User does not have an associated employee or client profile.');
      }

      const { template, modelName, modelVersion, embeddingDimension } = req.body;
      const result = await faceEnrollmentService.registerFace(user.employeeId, user.tenantId, {
        template,
        modelName,
        modelVersion,
        embeddingDimension,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTemplate(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const user = currentUser(req);
      if (!user.employeeId) {
        throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'User does not have an associated employee profile.');
      }

      const result = await faceEnrollmentService.getTemplate(user.employeeId);
      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeFace(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const user = currentUser(req);
      if (!user.employeeId) {
        throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'User does not have an associated employee profile.');
      }

      const result = await faceEnrollmentService.revokeFace(user.employeeId);
      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const faceEnrollmentController = new FaceEnrollmentController();
