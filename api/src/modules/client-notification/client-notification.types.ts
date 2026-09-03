export interface RoleRecipientDto {
  role: string;
  recipients: string[];
}

export interface UpdateNotificationSettingsDto {
  patrolCompletedEmailEnabled?: boolean;
  recipients?: string[];
  roleRecipients?: RoleRecipientDto[];
}

export interface NotificationSettingsResponse {
  patrolCompletedEmailEnabled: boolean;
  recipients: string[];
  roleRecipients: RoleRecipientDto[];
}
