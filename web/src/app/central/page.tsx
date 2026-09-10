'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CentralPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/central/dashboard');
  }, [router]);

  return null;
}
