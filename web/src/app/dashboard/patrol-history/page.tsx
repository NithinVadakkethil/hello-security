'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PatrolHistoryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/patrol-sessions?tab=history');
  }, [router]);

  return null;
}
