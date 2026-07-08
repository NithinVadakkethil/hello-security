import { z } from 'zod';

export const createAssignmentSchema = z.object({
  employeeId: z.string().cuid(),

  siteId: z.string().cuid(),

  shiftId: z.string().cuid(),

  patrolRouteId: z.string().cuid(),

  effectiveFrom: z.coerce.date(),

  effectiveTo: z.coerce.date().optional(),
});

export const updateAssignmentSchema = createAssignmentSchema
  .omit({
    employeeId: true,
  })
  .partial();
