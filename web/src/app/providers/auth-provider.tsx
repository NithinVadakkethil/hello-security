'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../store/auth-store';
import { getAccessToken, getUserFromToken, clearTokens } from '../utils/token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, isLoading, setLoading } = useAuthStore();

  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = getAccessToken();
        if (token) {
          const user = getUserFromToken(token);
          if (user) {
            setAuth(user);
            return;
          }
        }
        
        // No valid token, clear state
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
        <div className="auth-loader-card">
          <div className="auth-spinner"></div>
          <h2 className="auth-loader-title">Hello Security</h2>
          <p className="auth-loader-subtitle">Establishing secure session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
