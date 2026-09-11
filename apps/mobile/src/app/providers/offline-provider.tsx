import React, { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../store/offline-store';
import { useAuthStore } from '../store/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { offlineSyncEngine } from '../services/offline-sync-engine';

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { setConnected, loadQueue } = useOfflineStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Register query client in the sync engine
    offlineSyncEngine.setQueryClient(queryClient);

    loadQueue();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected;
      setConnected(isOnline);

      if (isOnline) {
        const { isAuthenticated, isLoading } = useAuthStore.getState();
        if (isAuthenticated && !isLoading) {
          offlineSyncEngine.sync();
        }
      }
    });

    return () => unsubscribe();
  }, [setConnected, loadQueue, queryClient]);

  return <>{children}</>;
}
