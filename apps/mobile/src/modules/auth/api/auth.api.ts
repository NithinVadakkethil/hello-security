import { authClient } from '../../../app/api/api-client';
import { ApiResponse, AuthData } from '../../../app/types/api';
import { LoginCredentials } from '../types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthData> => {
    const response = await authClient.post<ApiResponse<AuthData>>('/auth/login', {
      email: credentials.email,
      password: credentials.password,
    });
    return response.data.data;
  },
};
