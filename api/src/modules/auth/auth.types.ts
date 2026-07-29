import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  tenantId: string | null;
  employeeId: string | null;
  email: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  companyName?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
