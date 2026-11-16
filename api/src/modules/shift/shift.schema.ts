import { z } from 'zod';
import { normalizeTimeInput } from '../mandatory-patrol/mandatory-patrol.util';

const timeInputSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val, ctx) => {
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
      return null;
    }
    const normalized = normalizeTimeInput(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid time (e.g. 11:00, 18:00, or 11)',
      });
      return z.NEVER;
    }
    return normalized;
  });

const requiredTimeSchema = z
  .string()
  .transform((val, ctx) => {
    const normalized = normalizeTimeInput(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid time (e.g. 08:00, 20:00, or 8)',
      });
      return z.NEVER;
    }
    return normalized;
  });

const optionalRequiredTimeSchema = z
  .string()
  .optional()
  .transform((val, ctx) => {
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
      return undefined;
    }
    const normalized = normalizeTimeInput(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid time (e.g. 08:00, 20:00, or 8)',
      });
      return z.NEVER;
    }
    return normalized;
  });

export const createShiftSchema = z
  .object({
    name: z.string().min(2).max(100),

    startTime: requiredTimeSchema,
    endTime: requiredTimeSchema,

    mandatoryPatrol1Time: timeInputSchema,
    mandatoryPatrol1WindowBefore: z.number().int().min(1).max(120).optional(),
    mandatoryPatrol1WindowAfter: z.number().int().min(1).max(120).optional(),

    mandatoryPatrol2Time: timeInputSchema,
    mandatoryPatrol2WindowBefore: z.number().int().min(1).max(120).optional(),
    mandatoryPatrol2WindowAfter: z.number().int().min(1).max(120).optional(),

    description: z.string().optional(),
  })
  .refine((data) => data.startTime !== data.endTime, {
    message: 'Start time and end time cannot be the same.',
    path: ['endTime'],
  });

export const updateShiftSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),

    startTime: optionalRequiredTimeSchema,
    endTime: optionalRequiredTimeSchema,

    mandatoryPatrol1Time: timeInputSchema,
    mandatoryPatrol1WindowBefore: z.number().int().min(1).max(120).optional(),
    mandatoryPatrol1WindowAfter: z.number().int().min(1).max(120).optional(),

    mandatoryPatrol2Time: timeInputSchema,
    mandatoryPatrol2WindowBefore: z.number().int().min(1).max(120).optional(),
    mandatoryPatrol2WindowAfter: z.number().int().min(1).max(120).optional(),

    description: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.startTime !== data.endTime;
      }
      return true;
    },
    {
      message: 'Start time and end time cannot be the same.',
      path: ['endTime'],
    },
  );
