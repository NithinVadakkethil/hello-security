import { z } from 'zod';

export const logoutAllDevicesSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password is required'),
  deviceId: z.string().optional(),
  deviceInfo: z.string().optional(),
});

export type LogoutAllDevicesDto = z.infer<typeof logoutAllDevicesSchema>;
