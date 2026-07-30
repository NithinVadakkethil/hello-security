import { z } from 'zod';

export const createGateSubTaskSchema = z.object({
  taskName: z
    .string()
    .min(1, 'Task name is required.')
    .max(100, 'Task name cannot exceed 100 characters.'),
  description: z.string().max(300, 'Description cannot exceed 300 characters.').optional(),
  displayOrder: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateGateSubTaskSchema = createGateSubTaskSchema.partial();

export const reorderGateSubTasksSchema = z.object({
  subTasks: z.array(
    z.object({
      id: z.string().min(1),
      displayOrder: z.number().int().min(0),
    }),
  ),
});
