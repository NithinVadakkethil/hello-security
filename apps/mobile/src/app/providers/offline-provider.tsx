import React, { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../store/offline-store';
import { apiClient } from '../api/api-client';
import { useQueryClient } from '@tanstack/react-query';

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { setConnected, dequeue, loadQueue } = useOfflineStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Load persisted mutations queue from SQLite cache on mount
    loadQueue();

    // Subscribe to connectivity changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected;
      setConnected(isOnline);

      if (isOnline) {
        // Replay mutations when connection is restored
        syncOfflineQueue();
      }
    });

    return () => unsubscribe();
  }, [setConnected, loadQueue]);

  const syncOfflineQueue = async () => {
    const activeQueue = useOfflineStore.getState().queue;
    if (activeQueue.length === 0) return;

    console.log(`[Offline Provider] Syncing ${activeQueue.length} pending actions...`);

    for (const item of activeQueue) {
      try {
        await apiClient.request({
          url: item.url,
          method: item.method,
          data: item.data,
        });
        await dequeue(item.id);
      } catch (err) {
        console.error(`[Offline Provider] Synchronization error for action ${item.id}:`, err);
        break; // Stop replaying sequence on error to preserve order
      }
    }

    queryClient.invalidateQueries();
  };

  return <>{children}</>;
}
