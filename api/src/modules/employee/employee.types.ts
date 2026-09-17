import { EmployeeStatus, IdentificationMethod, UserRole } from '@prisma/client';

export interface CreateEmployeeDto {
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  designation?: string | null;
  companyName?: string | null;
  joiningDate?: Date | null;
  identificationMethod?: IdentificationMethod;
  role: UserRole;
  supervisedRole?: UserRole | null;
}

export interface UpdateEmployeeDto {
  firstName?: string;
  lastName?: string | null;
  phone?: string | null;
  designation?: string | null;
  companyName?: string | null;
  joiningDate?: Date | null;
  status?: EmployeeStatus;
  role?: UserRole;
  supervisedRole?: UserRole | null;
}
