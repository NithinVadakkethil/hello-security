import { z } from 'zod';

export const createPatrolRouteGateSchema = z.object({
  gateId: z.string().min(1),

  sequence: z.number().int().positive(),
});

export const updatePatrolRouteGateSchema = z.object({
  sequence: z.number().int().positive().optional(),
});
