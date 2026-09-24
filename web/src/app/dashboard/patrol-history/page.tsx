'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PatrolHistoryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/completed-patrols');
  }, [router]);

  return null;
}
