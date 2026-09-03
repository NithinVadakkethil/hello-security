import { z } from 'zod';

export const roleRecipientSchema = z.object({
  role: z.string().min(1, 'Role is required.'),
  recipients: z.array(z.string().email('Invalid email address format.')),
});

export const updateNotificationSettingsSchema = z.object({
  patrolCompletedEmailEnabled: z.boolean().optional(),
  recipients: z.array(z.string().email('Invalid email address format.')).optional(),
  roleRecipients: z.array(roleRecipientSchema).optional(),
});
