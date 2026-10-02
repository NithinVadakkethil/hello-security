import { prisma } from '../../database/prisma';
import { logger } from '../../common/logger/logger';

export interface CreateNotificationParams {
  clientId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  idempotencyKey?: string;
}

export class NotificationService {
  /**
   * Create a generic business notification and resolve authorized Client Admins/Managers.
   * Enforces strict idempotency based on idempotencyKey.
   */
  async createNotification(params: CreateNotificationParams) {
    const { clientId, type, title, message, entityType, entityId, metadata, idempotencyKey } = params;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await prisma.notification.findUnique({
        where: { idempotencyKey },
        include: { recipients: true },
      });
      if (existing) {
        logger.info(`[NotificationService] Duplicate event ignored for idempotency key: ${idempotencyKey}`);
        return existing;
      }
    }

    // 2. Resolve Authorized Recipients (Client Admins & Client Managers)
    const directAdmins = await prisma.user.findMany({
      where: {
        clientId,
        role: 'CLIENT_ADMIN',
        isActive: true,
      },
      select: { id: true },
    });

    const managerMemberships = await prisma.managerClientMembership.findMany({
      where: {
        clientId,
        isActive: true,
        managerUser: { isActive: true },
      },
      select: { managerUserId: true },
    });

    const recipientUserIds = Array.from(
      new Set([
        ...directAdmins.map((u) => u.id),
        ...managerMemberships.map((m) => m.managerUserId),
      ]),
    );

    // 3. Create Notification & Recipient Records
    try {
      const notification = await prisma.notification.create({
        data: {
          clientId,
          type,
          title,
          message,
          entityType,
          entityId,
          metadata: metadata || undefined,
          idempotencyKey: idempotencyKey || undefined,
          recipients: {
            create: recipientUserIds.map((userId) => ({
              userId,
              isRead: false,
            })),
          },
        },
        include: {
          recipients: true,
        },
      });

      logger.info(
        `✅ Business Notification created: [${type}] "${title}" for ${recipientUserIds.length} recipients (clientId: ${clientId})`,
      );

      return notification;
    } catch (err: any) {
      // Handle potential race condition on idempotency key
      if (err.code === 'P2002' && idempotencyKey) {
        logger.info(`[NotificationService] Idempotency catch for key: ${idempotencyKey}`);
        return prisma.notification.findUnique({
          where: { idempotencyKey },
          include: { recipients: true },
        });
      }
      throw err;
    }
  }

  /**
   * Get notifications for a specific user (Client Admin / Manager)
   */
  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.notificationUserRecipient.findMany({
        where: { userId },
        include: {
          notification: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notificationUserRecipient.count({
        where: { userId },
      }),
    ]);

    const formatted = items.map((item) => ({
      id: item.notification.id,
      recipientId: item.id,
      type: item.notification.type,
      title: item.notification.title,
      message: item.notification.message,
      entityType: item.notification.entityType,
      entityId: item.notification.entityId,
      metadata: item.notification.metadata,
      isRead: item.isRead,
      readAt: item.readAt,
      createdAt: item.createdAt,
    }));

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get total unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notificationUserRecipient.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    return prisma.notificationUserRecipient.updateMany({
      where: {
        userId,
        notificationId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string) {
    return prisma.notificationUserRecipient.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}

export const notificationService = new NotificationService();
