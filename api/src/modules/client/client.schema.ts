import { z } from 'zod';

export const createClientSchema = z.object({
  companyName: z.string().min(2).max(100),

  email: z.string().email(),

  authorizedPerson: z.string().optional(),

  phone: z.string().optional(),

  address: z.string().optional(),

  identificationMethod: z.enum(['QR', 'RFID']).default('QR'),

  maxEmployees: z.coerce.number().int().positive(),

  maxCheckpoints: z.coerce.number().int().positive().optional(),

  isActive: z.boolean().optional(),

  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED']).optional(),
});

export const updateClientSchema = createClientSchema.partial();
