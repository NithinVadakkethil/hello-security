'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../store/auth-store';
import {
  getAccessToken,
  getUserFromToken,
  getStoredUser,
  clearTokens,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../utils/token';
import { authClient } from '../lib/axios';
import LoadingState from '../components/ui/LoadingState';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, isLoading, setLoading } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = getAccessToken();
        const storedUser = getStoredUser();

        if (token) {
          // Restore stored user with name/companyName if available
          const initialUser = storedUser || getUserFromToken(token);
          if (initialUser) {
            setAuth(initialUser);
          }

          // Fetch latest profile from API to ensure fresh user information
          try {
            const meResponse = await authClient.get('/auth/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const profileUser = meResponse.data?.data;
            if (profileUser) {
              setAuth(profileUser);
            }
          } catch (profileErr) {
            console.log('[AuthProvider] Profile fetch notice:', profileErr);
          }

          setLoading(false);
          return;
        }

        // If access token is expired or missing, attempt session refresh
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          try {
            const response = await authClient.post('/auth/refresh', { refreshToken });
            const { accessToken: newAccessToken, refreshToken: newRefreshToken, user } =
              response.data.data;

            setAccessToken(newAccessToken);
            if (newRefreshToken) {
              setRefreshToken(newRefreshToken);
            }
            setAuth(user);
            setLoading(false);
            return;
          } catch (refreshError) {
            console.error('Mount session auto-refresh failed:', refreshError);
          }
        }

        // No valid token/session, clear state
        clearTokens();
        clearAuth();
      } catch {
        clearTokens();
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [setAuth, clearAuth, setLoading]);

  if (isLoading) {
    return (
      <div className="auth-loader-container">
        <LoadingState variant="card" size="lg" message="Establishing secure session..." />
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthProvider;
