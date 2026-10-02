import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { HttpStatus } from '../../common/errors/HttpStatus';

export class NotificationController {
  async list(req: Request, res: Response) {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const result = await notificationService.getUserNotifications(userId, page, limit);

    return res.status(HttpStatus.OK).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }

  async unreadCount(req: Request, res: Response) {
    const userId = req.user!.id;
    const count = await notificationService.getUnreadCount(userId);

    return res.status(HttpStatus.OK).json({
      success: true,
      data: { unreadCount: count },
    });
  }

  async markAsRead(req: Request, res: Response) {
    const userId = req.user!.id;
    const notificationId = req.params.id as string;

    await notificationService.markAsRead(userId, notificationId);

    return res.status(HttpStatus.OK).json({
      success: true,
      message: 'Notification marked as read.',
    });
  }

  async markAllAsRead(req: Request, res: Response) {
    const userId = req.user!.id;

    await notificationService.markAllAsRead(userId);

    return res.status(HttpStatus.OK).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  }
}

export const notificationController = new NotificationController();
