import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { clientNotificationRepository } from './client-notification.repository';
import { UpdateNotificationSettingsDto } from './client-notification.types';

export class ClientNotificationService {
  async getSettings(clientId: string) {
    if (!clientId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Client ID is required.',
      );
    }

    const settings = await clientNotificationRepository.getSettings(clientId);

    const globalRecipients = settings.recipients
      .filter((r: any) => r.role === 'GLOBAL' || !r.role)
      .map((r: any) => r.email);

    const roleMap: Record<string, string[]> = {};
    settings.recipients
      .filter((r: any) => r.role && r.role !== 'GLOBAL')
      .forEach((r: any) => {
        const role = r.role.toUpperCase();
        if (!roleMap[role]) {
          roleMap[role] = [];
        }
        roleMap[role].push(r.email);
      });

    const roleRecipients = Object.keys(roleMap).map((role) => ({
      role,
      recipients: roleMap[role],
    }));

    return {
      patrolCompletedEmailEnabled: settings.patrolCompletedEmailEnabled,
      recipients: globalRecipients,
      roleRecipients,
    };
  }

  async updateSettings(clientId: string, dto: UpdateNotificationSettingsDto) {
    if (!clientId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Client ID is required.',
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (dto.recipients !== undefined) {
      if (dto.recipients.length > 50) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'Maximum of 50 global recipient emails allowed.',
        );
      }

      for (const email of dto.recipients) {
        const trimmed = email.trim();
        if (!trimmed || !emailRegex.test(trimmed)) {
          throw new AppError(
            HttpStatus.BAD_REQUEST,
            ErrorCodes.VALIDATION_ERROR,
            `Invalid email address format: "${email}"`,
          );
        }
      }
    }

    if (dto.roleRecipients !== undefined) {
      for (const roleGroup of dto.roleRecipients) {
        for (const email of roleGroup.recipients || []) {
          const trimmed = email.trim();
          if (!trimmed || !emailRegex.test(trimmed)) {
            throw new AppError(
              HttpStatus.BAD_REQUEST,
              ErrorCodes.VALIDATION_ERROR,
              `Invalid email address format for role ${roleGroup.role}: "${email}"`,
            );
          }
        }
      }
    }

    const updated = await clientNotificationRepository.updateSettings(clientId, dto);

    const globalRecipients = updated.recipients
      .filter((r: any) => r.role === 'GLOBAL' || !r.role)
      .map((r: any) => r.email);

    const roleMap: Record<string, string[]> = {};
    updated.recipients
      .filter((r: any) => r.role && r.role !== 'GLOBAL')
      .forEach((r: any) => {
        const role = r.role.toUpperCase();
        if (!roleMap[role]) {
          roleMap[role] = [];
        }
        roleMap[role].push(r.email);
      });

    const roleRecipients = Object.keys(roleMap).map((role) => ({
      role,
      recipients: roleMap[role],
    }));

    return {
      patrolCompletedEmailEnabled: updated.patrolCompletedEmailEnabled,
      recipients: globalRecipients,
      roleRecipients,
    };
  }
}

export const clientNotificationService = new ClientNotificationService();
