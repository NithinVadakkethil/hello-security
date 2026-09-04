import { z } from 'zod';

export const startPatrolSchema = z.object({
  assignmentId: z.string().cuid(),
  startedAt: z.string().optional(),
});

export const completePatrolSchema = z.object({
  remarks: z.string().max(500).optional(),
  endedAt: z.string().optional(),
  completedAt: z.string().optional(),
});
