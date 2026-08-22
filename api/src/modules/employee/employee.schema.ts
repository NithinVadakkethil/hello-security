import { EmployeeStatus, IdentificationMethod, UserRole } from '@prisma/client';
import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().optional(),

  email: z.string().email().optional(),

  phone: z.string().optional(),

  designation: z.string().optional(),

  joiningDate: z.coerce.date().optional(),

  identificationMethod: z
    .nativeEnum(IdentificationMethod)
    .default(IdentificationMethod.QR),

  role: z.nativeEnum(UserRole),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(2).optional(),

  lastName: z.string().optional(),

  email: z.string().email().optional(),

  phone: z.string().optional(),

  designation: z.string().optional(),

  joiningDate: z.coerce.date().optional(),

  status: z.nativeEnum(EmployeeStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
});
