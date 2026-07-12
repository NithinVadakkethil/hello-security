import { z } from 'zod';

export const createIncidentSchema = z.object({
  type: z.string().min(1, 'Incident type is required'),
  severity: z.string().min(1, 'Severity level is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  images: z.preprocess((val) => {
    if (!val) return [];
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [val];
      }
    }
    return val;
  }, z.array(z.string())).optional(),
  patrolSessionId: z.preprocess((val) => {
    if (val === '' || val === 'null' || val === 'undefined') return null;
    return val;
  }, z.string().nullable().optional()),
  gateId: z.preprocess((val) => {
    if (val === '' || val === 'null' || val === 'undefined') return null;
    return val;
  }, z.string().nullable().optional()),
  latitude: z.preprocess((val) => {
    if (val === '' || val === 'null' || val === 'undefined' || val === undefined || val === null) return null;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }, z.number().nullable().optional()),
  longitude: z.preprocess((val) => {
    if (val === '' || val === 'null' || val === 'undefined' || val === undefined || val === null) return null;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }, z.number().nullable().optional()),
});

export type CreateIncidentDto = z.infer<typeof createIncidentSchema>;
