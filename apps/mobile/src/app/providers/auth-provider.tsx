import React, { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../store/auth-store';
import { tokenManager } from '../utils/token-manager';
import { authClient } from '../api/api-client';
import { ApiResponse, AuthData } from '../types/api';
import { offlineSyncEngine } from '../services/offline-sync-engine';
import { useOfflineStore } from '../store/offline-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // 1. Detect connectivity state immediately
        const netState = await NetInfo.fetch();
        const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
        useOfflineStore.getState().setConnected(isOnline);

        const accessToken = tokenManager.getAccessToken();
        const refreshToken = tokenManager.getRefreshToken();
        const cachedUser = tokenManager.getUserSession();
        const isOfflineEligible = tokenManager.isOfflineSessionEligible();

        console.log('[AuthProvider] Startup initialization:', {
          isOnline,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasCachedUser: !!cachedUser,
          isOfflineEligible,
        });

        // -----------------------------------------------------------------
        // STATE D: Previously authenticated, NO INTERNET (Cold Offline Launch)
        // -----------------------------------------------------------------
        if (!isOnline) {
          if (cachedUser && isOfflineEligible) {
            console.log('[AuthProvider] Offline cold start: restoring authorized offline session for:', cachedUser.email);
            setAuth(cachedUser);
            if (isMounted) setLoading(false);
            await useOfflineStore.getState().loadQueue();
            return;
          } else {
            console.log('[AuthProvider] Offline cold start: no eligible offline session found');
            clearAuth();
            if (isMounted) setLoading(false);
            return;
          }
        }

        // -----------------------------------------------------------------
        // ONLINE LAUNCH (Fast hydration + background/fast validation)
        // -----------------------------------------------------------------
        // Pre-hydrate in-memory state to avoid UI flash while network check completes
        if (cachedUser && isOfflineEligible) {
          setAuth(cachedUser);
        }

        // Attempt 1: Verify current session via /auth/me
        if (accessToken) {
          try {
            const response = await authClient.get<ApiResponse<any>>('/auth/me', {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 8000,
            });

            if (!isMounted) return;

            const verifiedUser = response.data.data;
            tokenManager.setUserSession(verifiedUser);
            tokenManager.updateOnlineTimestamp();
            setAuth(verifiedUser);
            setLoading(false);
            await useOfflineStore.getState().loadQueue();
            offlineSyncEngine.sync();
            return;
          } catch (err: any) {
            console.log('[AuthProvider] /auth/me check failed:', err?.message || err);
            const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK';

            // If network is unreachable or timed out, gracefully keep the valid offline session
            if (isNetworkError && cachedUser && isOfflineEligible) {
              console.log('[AuthProvider] Server unreachable during /auth/me: falling back to offline session');
              setAuth(cachedUser);
              if (isMounted) setLoading(false);
              await useOfflineStore.getState().loadQueue();
              return;
            }
            // If it was a 401 Unauthorized, we proceed to attempt token refresh
          }
        }

        // Attempt 2: Refresh session via /auth/refresh
        if (refreshToken) {
          try {
            const response = await authClient.post<ApiResponse<AuthData>>('/auth/refresh', {
              refreshToken,
            }, {
              timeout: 8000,
            });

            if (!isMounted) return;

            const { accessToken: newAccessToken, refreshToken: newRefreshToken, user } =
              response.data.data;

            tokenManager.setAccessToken(newAccessToken);
            if (newRefreshToken) {
              tokenManager.setRefreshToken(newRefreshToken);
            }
            tokenManager.setUserSession(user);
            tokenManager.updateOnlineTimestamp();
            setAuth(user);
            setLoading(false);
            await useOfflineStore.getState().loadQueue();
            offlineSyncEngine.sync();
            return;
          } catch (refreshErr: any) {
            console.warn('[AuthProvider] Session refresh attempt failed:', refreshErr?.message || refreshErr);
            const isNetworkError = !refreshErr.response || refreshErr.code === 'ECONNABORTED' || refreshErr.code === 'ERR_NETWORK';

            // Network failure during refresh must NOT destroy an eligible offline session
            if (isNetworkError && cachedUser && isOfflineEligible) {
              console.log('[AuthProvider] Server unreachable during refresh: falling back to offline session');
              setAuth(cachedUser);
              if (isMounted) setLoading(false);
              await useOfflineStore.getState().loadQueue();
              return;
            }

            // Only if server explicitly rejected with 401/403 is the session truly revoked
            const isExplicitRevocation =
              refreshErr.response &&
              (refreshErr.response.status === 401 || refreshErr.response.status === 403);

            if (isExplicitRevocation) {
              console.log('[AuthProvider] Refresh token rejected by server: clearing session');
              tokenManager.clearSession();
              clearAuth();
              if (isMounted) setLoading(false);
              return;
            }
          }
        }

        // If no tokens or session is invalid and cannot be verified
        if (cachedUser && isOfflineEligible) {
          // Fallback to offline session if eligible
          console.log('[AuthProvider] Maintaining offline session fallback');
          setAuth(cachedUser);
          await useOfflineStore.getState().loadQueue();
        } else {
          tokenManager.clearSession();
          clearAuth();
        }
      } catch (fatalErr) {
        console.error('[AuthProvider] Unexpected initialization error:', fatalErr);
        const cachedUser = tokenManager.getUserSession();
        if (cachedUser && tokenManager.isOfflineSessionEligible()) {
          setAuth(cachedUser);
          await useOfflineStore.getState().loadQueue();
        } else {
          clearAuth();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [setAuth, clearAuth, setLoading]);

  return <>{children}</>;
}
