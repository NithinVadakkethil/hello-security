import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { scanCheckpointSchema } from './patrol-checkpoint.schema';
import { patrolCheckpointService } from './patrol-checkpoint.service';

export class PatrolCheckpointController {
  async scan(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);

      const body = scanCheckpointSchema.parse(req.body);

      const result = await patrolCheckpointService.scan(user.employeeId!, body);

      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async history(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patrolCheckpointService.history(
        req.params.sessionId as string,
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const patrolCheckpointController = new PatrolCheckpointController();
