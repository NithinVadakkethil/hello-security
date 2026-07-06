import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  tenantId: string | null;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
