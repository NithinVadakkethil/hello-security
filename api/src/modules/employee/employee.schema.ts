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

  companyName: z.string().trim().max(150, 'Company name cannot exceed 150 characters').nullable().optional(),

  joiningDate: z.coerce.date().nullable().optional(),

  identificationMethod: z
    .nativeEnum(IdentificationMethod)
    .default(IdentificationMethod.QR),

  role: z.nativeEnum(UserRole),
  supervisedRole: z.nativeEnum(UserRole).nullable().optional(),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).optional(),

  lastName: z.string().trim().nullable().optional(),

  phone: z.string().trim().nullable().optional(),

  designation: z.string().trim().nullable().optional(),

  companyName: z.string().trim().max(150, 'Company name cannot exceed 150 characters').nullable().optional(),

  joiningDate: z.coerce.date().nullable().optional(),

  status: z.nativeEnum(EmployeeStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
  supervisedRole: z.nativeEnum(UserRole).nullable().optional(),
});
