'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from './constants';
import { ProtectedRoute } from './components/protected-route';

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect authenticated users to the dashboard
    router.replace(ROUTES.DASHBOARD);
  }, [router]);

  return (
    <ProtectedRoute isPublic={false}>
      <div className="auth-loader-container">
        <div className="auth-loader-card">
          <div className="auth-spinner"></div>
          <h2 className="auth-loader-title">Hello Security</h2>
          <p className="auth-loader-subtitle">Loading security environment...</p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
