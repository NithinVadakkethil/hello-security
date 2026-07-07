import { z } from 'zod';

export const createSiteSchema = z.object({
  name: z.string().min(3).max(100),

  address: z.string().min(5),

  latitude: z.number().optional(),

  longitude: z.number().optional(),

  radius: z.number().positive().optional(),

  contactPerson: z.string().optional(),

  contactPhone: z.string().optional(),

  description: z.string().optional(),
});

export const updateSiteSchema = createSiteSchema.partial();
