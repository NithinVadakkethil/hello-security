import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const createCheckpointCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Category name must be less than 100 characters'),
  description: z.string().trim().max(255).optional(),
});

export const updateCheckpointCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Category name must be less than 100 characters').optional(),
  description: z.string().trim().max(255).optional().nullable(),
});

export const createCategorySubTaskSchema = z.object({
  role: z.nativeEnum(UserRole).default(UserRole.SECURITY),
  taskName: z.string().trim().min(1, 'Task name is required').max(150),
  description: z.string().trim().max(500).optional().nullable(),
  displayOrder: z.number().int().optional(),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const updateCategorySubTaskSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  taskName: z.string().trim().min(1, 'Task name is required').max(150).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  displayOrder: z.number().int().optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const reorderCategorySubTasksSchema = z.object({
  subTasks: z.array(
    z.object({
      id: z.string().cuid(),
      displayOrder: z.number().int(),
    })
  ),
});
