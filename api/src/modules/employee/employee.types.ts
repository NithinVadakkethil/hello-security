import { EmployeeStatus, IdentificationMethod, UserRole } from '@prisma/client';

export interface CreateEmployeeDto {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  designation?: string;
  joiningDate?: Date;
  identificationMethod?: IdentificationMethod;
  role: UserRole;
}

export interface UpdateEmployeeDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  designation?: string;
  joiningDate?: Date;
  status?: EmployeeStatus;
}
