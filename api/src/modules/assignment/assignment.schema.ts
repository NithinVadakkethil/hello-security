import { z } from 'zod';

export const createAssignmentSchema = z.object({
  employeeId: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),

  siteId: z.string().min(1),

  shiftId: z.string().min(1),

  assignmentType: z.enum(['ROUTE', 'DIRECT_CHECKPOINTS']).optional(),

  patrolRouteId: z.string().optional(),
  patrolRouteIds: z.array(z.string()).optional(),

  gateIds: z.array(z.string()).optional(),

  effectiveFrom: z.coerce.date(),

  effectiveTo: z.coerce.date().optional(),
});

export const updateAssignmentSchema = createAssignmentSchema
  .omit({
    employeeId: true,
    employeeIds: true,
  })
  .partial();
