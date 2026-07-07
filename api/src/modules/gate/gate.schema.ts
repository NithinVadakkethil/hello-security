import { z } from 'zod';

export const createGateSchema = z.object({
  siteId: z.string().cuid(),

  name: z.string().min(2).max(100),

  description: z.string().optional(),

  latitude: z.number().optional(),

  longitude: z.number().optional(),

  sequence: z.number().int().positive(),
});

export const updateGateSchema = createGateSchema
  .omit({
    siteId: true,
  })
  .partial();
