'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth-store';
import { ROUTES } from '../constants';

interface ProtectedRouteProps {
  children: React.ReactNode;
  isPublic?: boolean;
}

export function ProtectedRoute({ children, isPublic = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isPublic) {
      // Preserve target path & query string for seamless post-login return
      const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
      const redirectParam = currentPath && currentPath !== '/' && currentPath !== ROUTES.LOGIN ? `?redirect=${encodeURIComponent(currentPath)}` : '';
      router.replace(`${ROUTES.LOGIN}${redirectParam}`);
    } else if (isAuthenticated && isPublic) {
      // Redirect to dashboard if trying to access public auth route while authenticated
      router.replace(ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, isLoading, isPublic, router]);

  // Show nothing while loading or if redirect is imminent
  if (isLoading) {
    return null;
  }

  if (!isAuthenticated && !isPublic) {
    return null;
  }

  if (isAuthenticated && isPublic) {
    return null;
  }

  return <>{children}</>;
}
