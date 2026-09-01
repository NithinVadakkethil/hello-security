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
    return {
      patrolCompletedEmailEnabled: settings.patrolCompletedEmailEnabled,
      recipients: settings.recipients.map((r: any) => r.email),
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

    if (dto.recipients !== undefined) {
      if (dto.recipients.length > 20) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'Maximum of 20 recipient emails allowed.',
        );
      }

      // Check email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

    const updated = await clientNotificationRepository.updateSettings(clientId, dto);

    return {
      patrolCompletedEmailEnabled: updated.patrolCompletedEmailEnabled,
      recipients: updated.recipients.map((r: any) => r.email),
    };
  }
}

export const clientNotificationService = new ClientNotificationService();
