import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { updateNotificationSettingsSchema } from './client-notification.schema';
import { clientNotificationService } from './client-notification.service';

export class ClientNotificationController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const clientId = user.tenantId;
      const settings = await clientNotificationService.getSettings(clientId!);

      return res.status(HttpStatus.OK).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      return next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const clientId = user.tenantId;
      const dto = updateNotificationSettingsSchema.parse(req.body);

      const settings = await clientNotificationService.updateSettings(
        clientId!,
        dto,
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Notification settings updated successfully.',
        data: settings,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const clientNotificationController = new ClientNotificationController();

