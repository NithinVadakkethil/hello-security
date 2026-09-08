import { EmployeeStatus, IdentificationMethod, UserRole } from '@prisma/client';
import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().nullable().optional(),

  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address'),

  phone: z.string().trim().nullable().optional(),

  designation: z.string().trim().nullable().optional(),

  joiningDate: z.coerce.date().nullable().optional(),

  identificationMethod: z
    .nativeEnum(IdentificationMethod)
    .default(IdentificationMethod.QR),

  role: z.nativeEnum(UserRole),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).optional(),

  lastName: z.string().trim().nullable().optional(),

  phone: z.string().trim().nullable().optional(),

  designation: z.string().trim().nullable().optional(),

  joiningDate: z.coerce.date().nullable().optional(),

  status: z.nativeEnum(EmployeeStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
});
