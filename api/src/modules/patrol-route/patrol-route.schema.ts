import { z } from 'zod';

export const checkpointSchema = z.object({
  gateId: z.string().cuid(),

  sequence: z.number().min(1),

  expectedDuration: z.number().optional(),
});

export const createPatrolRouteSchema = z.object({
  siteId: z.string().cuid(),

  name: z.string().min(2).max(100),

  description: z.string().optional(),

  checkpoints: z.array(checkpointSchema).min(1),
});

export const updatePatrolRouteSchema = z.object({
  name: z.string().optional(),

  description: z.string().optional(),

  isActive: z.boolean().optional(),
});
