import { apiClient } from '../api/api-client';
import { useOfflineStore, OfflineMutation } from '../store/offline-store';
import { QueryClient } from '@tanstack/react-query';
import { usePatrolStore } from '../../modules/patrol/store/patrol-store';

const MAX_RETRIES = 3;

export class OfflineSyncEngine {
  private static instance: OfflineSyncEngine;
  private isLocked = false;
  private queryClient: QueryClient | null = null;

  private constructor() {}

  public static getInstance(): OfflineSyncEngine {
    if (!OfflineSyncEngine.instance) {
      OfflineSyncEngine.instance = new OfflineSyncEngine();
    }
    return OfflineSyncEngine.instance;
  }

  public setQueryClient(client: QueryClient) {
    this.queryClient = client;
  }

  public async sync(): Promise<void> {
    const { isConnected, queue, setSyncing, setLastSyncTime, dequeue, updateMutationStatus } = useOfflineStore.getState();

    if (!isConnected || this.isLocked || queue.length === 0) {
      return;
    }

    this.isLocked = true;
    setSyncing(true);
    console.log(`[OfflineSyncEngine] Initiating sync for ${queue.length} items...`);

    let realSessionId: string | null = null;

    for (const item of queue) {
      // Skip items that have already exceeded max retries to avoid blocking the queue
      if (item.retryCount >= MAX_RETRIES) {
        console.warn(`[OfflineSyncEngine] Item ${item.id} exceeded max retries. Skipping.`);
        continue;
      }

      await updateMutationStatus(item.id, 'syncing');

      // Apply Exponential Backoff if retrying
      if (item.retryCount > 0) {
        const backoffDelay = Math.pow(2, item.retryCount) * 1000;
        console.log(`[OfflineSyncEngine] Retrying item ${item.id} (attempt ${item.retryCount + 1}) after backoff of ${backoffDelay}ms`);
        await new Promise<void>((resolve) => setTimeout(() => resolve(), backoffDelay));
      }

      try {
        let url = item.url;
        // Dynamically map temp patrol session IDs to the real ID
        if (realSessionId && url.includes('temp-active-session')) {
          url = url.replace('temp-active-session', realSessionId);
        }

        const response = await apiClient.request({
          url,
          method: item.method,
          data: item.data,
        }) as any;

        // If it was a patrol start session, capture the real session ID
        if (item.url.endsWith('/patrol-sessions/start') && response?.data?.id) {
          realSessionId = response.data.id;
          
          // Update the active patrol session in Zustand store and SQLite DB to use the real database ID
          const { activeSession, startSession } = usePatrolStore.getState();
          if (activeSession && activeSession.id === 'temp-active-session' && realSessionId) {
            const updatedSession = {
              ...activeSession,
              id: realSessionId,
            };
            await startSession(updatedSession);
            console.log(`[OfflineSyncEngine] Updated local activeSession ID to real ID: ${realSessionId}`);
          }
        }

        await dequeue(item.id);
        console.log(`[OfflineSyncEngine] Successfully synchronized item ${item.id}`);
      } catch (err: any) {
        const statusCode = err.response?.status;
        const errMsg = err.response?.data?.message || err.message || 'Unknown network error';

        console.error(`[OfflineSyncEngine] Sync failure for item ${item.id}:`, errMsg);

        if (statusCode === 409) {
          // Conflict Handling: default to server_wins (discard/dequeue) to unblock queue, or allow manual strategy
          console.warn(`[OfflineSyncEngine] Conflict (409) detected for item ${item.id}. Discarding to unblock queue.`);
          await dequeue(item.id);
        } else if (statusCode >= 400 && statusCode < 500 && statusCode !== 408) {
          // Fatal Client Error: 400 Bad Request, 422 Validation - will never succeed on retries
          await updateMutationStatus(item.id, 'failed', `Fatal Client Error (${statusCode}): ${errMsg}`, false);
          break; // Stop replaying sequence to preserve operations order
        } else {
          // Transient Network/Server Error (5xx, timeouts, connection drop)
          await updateMutationStatus(item.id, 'failed', `Transient Error: ${errMsg}`, true);
          break; // Stop replaying sequence to preserve operations order
        }
      }
    }

    setSyncing(false);
    setLastSyncTime(Date.now());
    this.isLocked = false;
    
    if (this.queryClient) {
      this.queryClient.invalidateQueries();
    }
  }
}

export const offlineSyncEngine = OfflineSyncEngine.getInstance();
