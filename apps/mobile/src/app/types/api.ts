export interface User {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'SECURITY';
  tenantId?: string | null;
  employeeId?: string | null;
  firstName?: string;
  lastName?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  user: User;
}
