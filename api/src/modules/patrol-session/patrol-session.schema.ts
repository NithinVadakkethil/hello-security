import { z } from 'zod';

export const startPatrolSchema = z.object({
  assignmentId: z.string().cuid(),
});

export const completePatrolSchema = z.object({
  remarks: z.string().max(500).optional(),
});
