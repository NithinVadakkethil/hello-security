'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from './constants';
import { ProtectedRoute } from './components/protected-route';

import LoadingState from './components/ui/LoadingState';

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect authenticated users to the dashboard
    router.replace(ROUTES.DASHBOARD);
  }, [router]);

  return (
    <ProtectedRoute isPublic={false}>
      <div className="auth-loader-container">
        <LoadingState variant="card" size="lg" message="Loading security environment..." />
      </div>
    </ProtectedRoute>
  );
}
