import { NotificationStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { RoleRecipientDto } from './client-notification.types';

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
      roleRecipients?: RoleRecipientDto[];
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

      // 2. Update recipients if global or roleRecipients provided
      if (data.recipients !== undefined || data.roleRecipients !== undefined) {
        // Delete old recipients
        await tx.notificationRecipient.deleteMany({
          where: { settingsId: existing.id },
        });

        const newRecipients: Array<{ settingsId: string; email: string; role: string; isActive: boolean }> = [];

        // Global recipients (role = "GLOBAL")
        if (data.recipients !== undefined) {
          const cleanGlobalEmails = Array.from(
            new Set(data.recipients.map((e) => e.trim().toLowerCase())),
          ).filter(Boolean);

          cleanGlobalEmails.forEach((email) => {
            newRecipients.push({
              settingsId: existing.id,
              email,
              role: 'GLOBAL',
              isActive: true,
            });
          });
        } else {
          // Preserve existing global recipients
          existing.recipients
            .filter((r) => r.role === 'GLOBAL')
            .forEach((r) => {
              newRecipients.push({
                settingsId: existing.id,
                email: r.email,
                role: 'GLOBAL',
                isActive: true,
              });
            });
        }

        // Role-wise recipients
        if (data.roleRecipients !== undefined) {
          data.roleRecipients.forEach((roleGroup) => {
            const roleName = roleGroup.role.toUpperCase().trim();
            const cleanRoleEmails = Array.from(
              new Set((roleGroup.recipients || []).map((e) => e.trim().toLowerCase())),
            ).filter(Boolean);

            cleanRoleEmails.forEach((email) => {
              newRecipients.push({
                settingsId: existing.id,
                email,
                role: roleName,
                isActive: true,
              });
            });
          });
        } else {
          // Preserve existing non-GLOBAL role recipients
          existing.recipients
            .filter((r) => r.role !== 'GLOBAL')
            .forEach((r) => {
              newRecipients.push({
                settingsId: existing.id,
                email: r.email,
                role: r.role,
                isActive: true,
              });
            });
        }

        if (newRecipients.length > 0) {
          await tx.notificationRecipient.createMany({
            data: newRecipients,
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
