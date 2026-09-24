'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PatrolSessionsRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    const search = searchParams.get('search');
    const page = searchParams.get('page');

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (page) params.set('page', page);

    const queryString = params.toString();

    if (tab === 'history') {
      router.replace(queryString ? `/dashboard/completed-patrols?${queryString}` : '/dashboard/completed-patrols');
    } else {
      router.replace(queryString ? `/dashboard/active-patrols?${queryString}` : '/dashboard/active-patrols');
    }
  }, [router, searchParams]);

  return null;
}

export default function PatrolSessionsRedirectPage() {
  return (
    <Suspense fallback={<div style={{ padding: '24px', color: '#64748b' }}>Redirecting...</div>}>
      <PatrolSessionsRedirectContent />
    </Suspense>
  );
}
