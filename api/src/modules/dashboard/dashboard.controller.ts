import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';

import { dashboardService } from './dashboard.service';

export class DashboardController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);

      const result = await dashboardService.get(user.tenantId!);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const dashboardController = new DashboardController();
