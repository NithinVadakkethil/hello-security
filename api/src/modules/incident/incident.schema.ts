import { z } from 'zod';

export const createIncidentSchema = z.object({
  type: z.string().min(1, 'Incident type is required'),
  severity: z.string().min(1, 'Severity level is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  images: z.array(z.string()).optional(),
  patrolSessionId: z.string().optional().nullable(),
  gateId: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type CreateIncidentDto = z.infer<typeof createIncidentSchema>;
