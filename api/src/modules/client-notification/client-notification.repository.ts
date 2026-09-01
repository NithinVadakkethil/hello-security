import { NotificationStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';

export class ClientNotificationRepository {
  async getSettings(clientId: string) {
    let settings = await prisma.clientNotificationSettings.findUnique({
      where: { clientId },
      include: {
        recipients: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!settings) {
      settings = await prisma.clientNotificationSettings.create({
        data: {
          clientId,
          patrolCompletedEmailEnabled: true,
        },
        include: {
          recipients: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return settings;
  }

  async updateSettings(
    clientId: string,
    data: {
      patrolCompletedEmailEnabled?: boolean;
      recipients?: string[];
    },
  ) {
    const existing = await this.getSettings(clientId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update settings flag
      await tx.clientNotificationSettings.update({
        where: { id: existing.id },
        data: {
          patrolCompletedEmailEnabled:
            data.patrolCompletedEmailEnabled ?? existing.patrolCompletedEmailEnabled,
        },
      });

      // 2. Update recipients list if provided
      if (data.recipients !== undefined) {
        // Delete old recipients
        await tx.notificationRecipient.deleteMany({
          where: { settingsId: existing.id },
        });

        // Deduplicate & trim emails (case-insensitive deduplication)
        const cleanEmails = Array.from(
          new Set(data.recipients.map((e) => e.trim().toLowerCase())),
        ).filter(Boolean);

        if (cleanEmails.length > 0) {
          await tx.notificationRecipient.createMany({
            data: cleanEmails.map((email) => ({
              settingsId: existing.id,
              email,
              isActive: true,
            })),
          });
        }
      }

      return tx.clientNotificationSettings.findUnique({
        where: { id: existing.id },
        include: {
          recipients: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    return result!;
  }

  async getDelivery(type: string, patrolSessionId: string, recipient: string) {
    return prisma.notificationDelivery.findUnique({
      where: {
        type_patrolSessionId_recipient: {
          type,
          patrolSessionId,
          recipient,
        },
      },
    });
  }

  async createDelivery(data: {
    clientId: string;
    patrolSessionId: string;
    type?: string;
    recipient: string;
    status?: NotificationStatus;
  }) {
    return prisma.notificationDelivery.create({
      data: {
        clientId: data.clientId,
        patrolSessionId: data.patrolSessionId,
        type: data.type || 'PATROL_COMPLETED',
        recipient: data.recipient,
        status: data.status || NotificationStatus.PENDING,
        attempts: 0,
      },
    });
  }

  async updateDeliveryStatus(
    id: string,
    data: {
      status: NotificationStatus;
      attempts?: number;
      providerMessageId?: string;
      errorMessage?: string;
      sentAt?: Date;
    },
  ) {
    return prisma.notificationDelivery.update({
      where: { id },
      data,
    });
  }
}

export const clientNotificationRepository = new ClientNotificationRepository();
