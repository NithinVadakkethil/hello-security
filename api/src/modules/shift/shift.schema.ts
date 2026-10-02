import { z } from 'zod';

export const createShiftSchema = z.object({
  name: z.string().min(2).max(100),

  startTime: z.string(),

  endTime: z.string(),

  mandatoryPatrol1Time: z.string().nullable().optional(),
  mandatoryPatrol1WindowBefore: z.number().int().min(1).max(120).optional(),
  mandatoryPatrol1WindowAfter: z.number().int().min(1).max(120).optional(),

  mandatoryPatrol2Time: z.string().nullable().optional(),
  mandatoryPatrol2WindowBefore: z.number().int().min(1).max(120).optional(),
  mandatoryPatrol2WindowAfter: z.number().int().min(1).max(120).optional(),

  description: z.string().optional(),
});

export const updateShiftSchema = createShiftSchema.partial();
