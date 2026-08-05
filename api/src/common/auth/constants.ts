import { UserRole } from '@prisma/client';

export const OPERATIONAL_ROLES: UserRole[] = [
  UserRole.SECURITY,
  UserRole.CLEANER,
  UserRole.SERVICE_ENGINEER,
  UserRole.TECHNICIAN,
  UserRole.LIFE_GUARD,
  UserRole.PLUMBER,
];
