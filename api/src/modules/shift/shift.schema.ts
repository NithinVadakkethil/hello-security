import { z } from 'zod';

export const createShiftSchema = z.object({
  name: z.string().min(2).max(100),

  startTime: z.string(),

  endTime: z.string(),

  description: z.string().optional(),
});

export const updateShiftSchema = createShiftSchema.partial();
