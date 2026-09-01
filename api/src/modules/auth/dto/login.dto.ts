import { z } from 'zod';

//Login dto
export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),

  password: z.string().min(1, 'Password is required'),

  deviceId: z.string().optional(),

  deviceInfo: z.string().optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
