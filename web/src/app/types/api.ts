export interface User {
  id: string;
  tenantId?: string;
  employeeId?: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'SECURITY';
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  companyName?: string | null;
}

export interface AuthData {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: boolean;
  message: string;
  error?: string;
  code?: string;
  validationErrors?: Record<string, string[]>;
}
