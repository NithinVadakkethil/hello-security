import { z } from 'zod';

export const createClientSchema = z.object({
  companyName: z.string().min(2).max(100),

  email: z.email(),

  phone: z.string().optional(),

  address: z.string().optional(),

  identificationMethod: z.enum(['QR', 'RFID']).default('QR'),

  maxEmployees: z.number().int().positive(),
});

export const updateClientSchema = createClientSchema.partial();
