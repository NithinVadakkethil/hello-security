'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '../components/protected-route';
import { useAuthStore } from '../store/auth-store';
import LoadingState from '../components/ui/LoadingState';

export default function AttendanceRedirectPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;
    if (
      user.role === 'MANAGER' ||
      (user.role as string) === 'CENTRAL_MANAGER' ||
      (user.role as string) === 'CENTRALIZED_MANAGER'
    ) {
      router.replace('/central/attendance');
    } else {
      router.replace('/dashboard/attendance');
    }
  }, [user, router]);

  return (
    <ProtectedRoute isPublic={false}>
      <div className="auth-loader-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <LoadingState variant="card" size="lg" message="Loading attendance..." />
      </div>
    </ProtectedRoute>
  );
}
