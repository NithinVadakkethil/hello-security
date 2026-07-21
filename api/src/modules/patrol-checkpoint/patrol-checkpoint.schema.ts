import { z } from 'zod';

export const scanCheckpointSchema = z.object({
  gateId: z.string().min(1),

  latitude: z.number().optional(),

  longitude: z.number().optional(),

  remarks: z.string().max(500).optional(),

  status: z.string().optional(),

  images: z.array(z.string()).optional(),
});
