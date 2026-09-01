export interface UpdateNotificationSettingsDto {
  patrolCompletedEmailEnabled?: boolean;
  recipients?: string[];
}

export interface NotificationSettingsResponse {
  patrolCompletedEmailEnabled: boolean;
  recipients: string[];
}
