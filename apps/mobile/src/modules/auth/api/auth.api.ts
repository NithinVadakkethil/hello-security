import { apiClient, authClient } from '../../../app/api/api-client';
import { ApiResponse, AuthData } from '../../../app/types/api';
import { getDeviceId, getDeviceInfo } from '../../../app/utils/device-id';
import { LoginCredentials } from '../types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthData> => {
    const deviceId = getDeviceId();
    const deviceInfo = getDeviceInfo();
    const response = await authClient.post<ApiResponse<AuthData>>('/auth/login', {
      email: credentials.email,
      password: credentials.password,
      deviceId,
      deviceInfo,
    });
    return response.data.data;
  },

  logoutAllDevices: async (credentials: LoginCredentials): Promise<AuthData> => {
    const deviceId = getDeviceId();
    const deviceInfo = getDeviceInfo();
    const response = await authClient.post<ApiResponse<AuthData>>('/auth/logout-all-devices', {
      email: credentials.email,
      password: credentials.password,
      deviceId,
      deviceInfo,
    });
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    const deviceId = getDeviceId();
    try {
      await apiClient.post('/auth/logout', { deviceId });
    } catch (err) {
      console.warn('[authApi] Logout notification to server failed:', err);
    }
  },
};
