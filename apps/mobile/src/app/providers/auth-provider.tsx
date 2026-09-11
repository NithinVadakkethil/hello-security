import React, { useEffect } from 'react';
import { useAuthStore } from '../store/auth-store';
import { tokenManager } from '../utils/token-manager';
import { authClient } from '../api/api-client';
import { ApiResponse, AuthData } from '../types/api';
import { offlineSyncEngine } from '../services/offline-sync-engine';
import { useOfflineStore } from '../store/offline-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const accessToken = tokenManager.getAccessToken();
        const refreshToken = tokenManager.getRefreshToken();

        if (accessToken) {
          try {
            const response = await authClient.get<ApiResponse<any>>('/auth/me', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            setAuth(response.data.data);
            setLoading(false);
            await useOfflineStore.getState().loadQueue();
            offlineSyncEngine.sync();
            return;
          } catch {
            console.log('[AuthProvider] Access token expired, attempting refresh...');
          }
        }

        if (refreshToken) {
          try {
            const response = await authClient.post<ApiResponse<AuthData>>('/auth/refresh', {
              refreshToken,
            });
            const { accessToken: newAccessToken, refreshToken: newRefreshToken, user } =
              response.data.data;

            tokenManager.setAccessToken(newAccessToken);
            if (newRefreshToken) {
              tokenManager.setRefreshToken(newRefreshToken);
            }
            setAuth(user);
            setLoading(false);
            await useOfflineStore.getState().loadQueue();
            offlineSyncEngine.sync();
            return;
          } catch (refreshErr) {
            console.error('[AuthProvider] Session restore failed:', refreshErr);
          }
        }

        tokenManager.clearTokens();
        clearAuth();
        useOfflineStore.setState({ queue: [] });
      } catch {
        tokenManager.clearTokens();
        clearAuth();
        useOfflineStore.setState({ queue: [] });
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [setAuth, clearAuth, setLoading]);

  return <>{children}</>;
}
