import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { authService } from '../services/auth.service';
import { LoginCredentials } from '../types';
import { AuthData } from '../../../app/types/api';
import { AxiosError } from 'axios';

export function useAuth() {
  const loginMutation = useMutation<AuthData, AxiosError<{ message?: string }>, LoginCredentials>({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      authService.handleLoginSuccess(data);
    },
  });

  const logoutAllDevicesMutation = useMutation<AuthData, AxiosError<{ message?: string }>, LoginCredentials>({
    mutationFn: authApi.logoutAllDevices,
    onSuccess: (data) => {
      authService.handleLoginSuccess(data);
    },
  });

  const logout = () => {
    authService.handleLogout();
  };

  return {
    login: loginMutation.mutateAsync,
    logoutAllDevices: logoutAllDevicesMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending || logoutAllDevicesMutation.isPending,
    loginError: loginMutation.error,
    logout,
  };
}
