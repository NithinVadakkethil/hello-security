'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';

function CentralAttendanceRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const clientId = searchParams.get('clientId');
    const params = new URLSearchParams();
    if (clientId) {
      params.set('clientId', clientId);
    }
    params.set('tab', 'attendance');
    router.replace(`/central/reports?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '350px',
        color: 'var(--text-secondary)',
        gap: '12px',
      }}
    >
      <Clock size={32} style={{ color: '#2563EB', animation: 'pulse 1.5s infinite' }} />
      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
        Redirecting to Reports &amp; Analytics &rarr; Attendance Reports...
      </p>
    </div>
  );
}

export default function CentralAttendancePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading Attendance Reports...
        </div>
      }
    >
      <CentralAttendanceRedirectContent />
    </Suspense>
  );
}
