import { z } from 'zod';

export const createSnagSchema = z.object({
  siteId: z.string().min(1, 'Site ID is required'),
  gateId: z.string().optional(),
  patrolSessionId: z.string().optional(),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  subCategory: z.string().optional(),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  images: z.array(z.string()).optional().default([]),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const updateSnagStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED', 'REJECTED']),
  notes: z.string().optional(),
});

export const addSnagCommentSchema = z.object({
  comment: z.string().min(1, 'Comment text is required'),
});

export const assignSnagSchema = z.object({
  assignedToId: z.string().min(1, 'Assigned user ID is required'),
  dueDate: z.string().optional(),
});
