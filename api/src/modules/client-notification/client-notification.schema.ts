import { z } from 'zod';

export const updateNotificationSettingsSchema = z.object({
  patrolCompletedEmailEnabled: z.boolean().optional(),
  recipients: z.array(z.string().email('Invalid email address format.')).optional(),
});
