import { apiClient } from '../api/api-client';
import { useOfflineStore, OfflineMutation } from '../store/offline-store';
import { QueryClient } from '@tanstack/react-query';
import { usePatrolStore } from '../../modules/patrol/store/patrol-store';
import { useAuthStore } from '../store/auth-store';
import { tokenManager } from '../utils/token-manager';

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
    const store = useOfflineStore.getState();
    const { isConnected, queue, setSyncing, setLastSyncTime, dequeue, updateMutationStatus, setSessionMapping } = store;
    const { isAuthenticated, isLoading: isAuthLoading, user: currentUser } = useAuthStore.getState();
    const accessToken = tokenManager.getAccessToken();

    // Guard 1: Basic pre-conditions
    if (!isConnected || this.isLocked || queue.length === 0) {
      return;
    }

    // Guard 2: Auth Hydration Guard — Wait for AuthProvider to finish restoring token/user state
    if (isAuthLoading) {
      console.log('[OfflineSyncEngine] Auth state is still hydrating. Deferring sync.');
      return;
    }

    // Guard 3: Authentication & Token Guard — Do NOT sync while logged out or on Login screen
    if (!isAuthenticated || !accessToken || !currentUser) {
      console.log('[OfflineSyncEngine] User unauthenticated or token missing. Sync paused until login.');
      return;
    }

    this.isLocked = true;
    setSyncing(true);

    // Refresh persistent queue & session mappings from storage
    await store.loadQueue();
    const currentQueue = useOfflineStore.getState().queue;
    const sessionMappings = useOfflineStore.getState().sessionMappings;

    console.log(`[OfflineSyncEngine] Initiating sync for ${currentQueue.length} items (Authenticated User: ${currentUser.email})...`);

    for (let index = 0; index < currentQueue.length; index++) {
      const item = currentQueue[index];

      // Skip items that exceeded max retries
      if (item.retryCount >= MAX_RETRIES) {
        console.warn(`[OfflineSyncEngine] Item ${item.id} exceeded max retries. Skipping.`);
        continue;
      }

      // Guard 4: Queue Ownership & Tenant Guard — Only sync mutations belonging to current user & client
      if (item.isLegacyUnowned) {
        console.warn(`[OfflineSyncEngine] Item ${item.id} (${item.url}) marked LEGACY_UNOWNED. Skipping to prevent unauthenticated execution.`);
        continue;
      }

      const itemOwnerUserId = item.ownerUserId || item.userId;
      const itemOwnerEmpId = item.ownerEmployeeId || item.employeeId;
      const currentUserEmpId = currentUser.employeeId || (currentUser as any)?.employee?.id;

      const isUserMatch =
        (itemOwnerUserId && itemOwnerUserId === currentUser.id) ||
        (itemOwnerEmpId && itemOwnerEmpId === currentUserEmpId);

      if (!isUserMatch) {
        console.warn(`[OfflineSyncEngine] SECURITY GUARD: Item ${item.id} (${item.url}) belongs to user ${itemOwnerUserId}, not active user ${currentUser.id}. Skipping.`);
        continue;
      }

      const itemOwnerClientId = item.ownerClientId;
      const currentUserClientId = (currentUser as any)?.clientId || (currentUser as any)?.client?.id;
      if (itemOwnerClientId && currentUserClientId && itemOwnerClientId !== currentUserClientId) {
        console.warn(`[OfflineSyncEngine] TENANT GUARD: Item ${item.id} belongs to client ${itemOwnerClientId}, not active client ${currentUserClientId}. Skipping.`);
        continue;
      }

      // Determine correlation ID for this item
      const itemOfflineId =
        item.offlineSessionId ||
        item.data?.offlineSessionId ||
        item.data?.patrolSessionId ||
        (item.url.includes('temp-active-session') ? 'temp-active-session' : undefined);

      const isStartMutation = item.url.endsWith('/patrol-sessions/start');
      const isCompleteMutation = item.url.includes('/complete');
      const isScanMutation = item.url.includes('/patrol-checkpoints/scan');

      // Resolve server session ID if mapped
      let mappedServerSessionId = itemOfflineId ? sessionMappings[itemOfflineId] : undefined;
      if (!mappedServerSessionId && sessionMappings['temp-active-session']) {
        mappedServerSessionId = sessionMappings['temp-active-session'];
      }

      // -------------------------------------------------------------
      // DEPENDENCY GUARD 1: SCAN/COMPLETE cannot proceed without START mapping
      // -------------------------------------------------------------
      if ((isScanMutation || isCompleteMutation) && itemOfflineId && !mappedServerSessionId) {
        const hasPendingStart = currentQueue.some(
          (m) =>
            m.url.endsWith('/patrol-sessions/start') &&
            (m.offlineSessionId === itemOfflineId || m.data?.offlineSessionId === itemOfflineId)
        );

        if (hasPendingStart) {
          console.log(`[OfflineSyncEngine] Item ${item.id} (${item.url}) waiting for parent START mutation to sync. Skipping for now.`);
          continue;
        }
      }

      // -------------------------------------------------------------
      // DEPENDENCY GUARD 2: COMPLETE cannot proceed while SCANS are pending
      // -------------------------------------------------------------
      if (isCompleteMutation && itemOfflineId) {
        const hasPendingScansAhead = currentQueue.slice(0, index).some((m) => {
          const mOfflineId = m.offlineSessionId || m.data?.offlineSessionId || m.data?.patrolSessionId;
          return m.url.includes('/patrol-checkpoints/scan') && (mOfflineId === itemOfflineId || !mOfflineId);
        });

        if (hasPendingScansAhead) {
          console.log(`[OfflineSyncEngine] Complete mutation ${item.id} waiting for scan mutations to sync first. Skipping.`);
          continue;
        }
      }

      await updateMutationStatus(item.id, 'syncing');

      // Exponential Backoff if retrying
      if (item.retryCount > 0) {
        const backoffDelay = Math.pow(2, item.retryCount) * 1000;
        console.log(`[OfflineSyncEngine] Retrying item ${item.id} (attempt ${item.retryCount + 1}) after ${backoffDelay}ms`);
        await new Promise<void>((resolve) => setTimeout(resolve, backoffDelay));
      }

      try {
        let url = item.url;
        let data = item.data ? JSON.parse(JSON.stringify(item.data)) : {};

        // Replace local offline ID / temp ID with server ID if mapping exists
        if (mappedServerSessionId) {
          if (itemOfflineId) {
            url = url.replace(itemOfflineId, mappedServerSessionId);
          }
          if (url.includes('temp-active-session')) {
            url = url.replace('temp-active-session', mappedServerSessionId);
          }
          if (data && typeof data === 'object') {
            data = JSON.parse(
              JSON.stringify(data)
                .replace(new RegExp(itemOfflineId || 'temp-active-session', 'g'), mappedServerSessionId)
                .replace(/temp-active-session/g, mappedServerSessionId)
            );
          }
          if (data && !data.patrolSessionId) {
            data.patrolSessionId = mappedServerSessionId;
          }
        }

        const response = (await apiClient.request({
          url,
          method: item.method,
          data,
        })) as any;

        // If patrol start succeeded, persist mapping permanently
        if (isStartMutation && response?.data?.id) {
          const createdServerId = response.data.id;
          if (itemOfflineId) {
            await setSessionMapping(itemOfflineId, createdServerId);
            sessionMappings[itemOfflineId] = createdServerId;
          }
          await setSessionMapping('temp-active-session', createdServerId);
          sessionMappings['temp-active-session'] = createdServerId;

          // Update active patrol session in Zustand store if active locally
          const { activeSession, startSession } = usePatrolStore.getState();
          if (activeSession && (activeSession.id === 'temp-active-session' || activeSession.id === itemOfflineId)) {
            await startSession({
              ...activeSession,
              id: createdServerId,
            });
            console.log(`[OfflineSyncEngine] Updated local activeSession ID to real ID: ${createdServerId}`);
          }
        }

        await dequeue(item.id);
        console.log(`[OfflineSyncEngine] Successfully synchronized item ${item.id}`);
      } catch (err: any) {
        const statusCode = err.response?.status;
        const errMsg = err.response?.data?.message || err.message || 'Unknown network error';

        console.error(`[OfflineSyncEngine] Sync failure for item ${item.id} (${item.url}):`, errMsg);

        if (statusCode === 401 || statusCode === 403) {
          // Authentication / Authorization Error: User session invalid or unauthenticated.
          // Do NOT increment retries count. Do NOT mark as fatal client error.
          console.warn(`[OfflineSyncEngine] Auth block (${statusCode}) for item ${item.id}. Pausing sync until valid login.`);
          await updateMutationStatus(item.id, 'pending', `Auth Blocked (${statusCode}): ${errMsg}`, false);
          break; // Stop replaying sequence without discarding queue data or incrementing retry count
        } else if (statusCode === 409) {
          // Conflict (409): Capture active patrol session ID if server already created it
          const conflictActiveId = err.response?.data?.error?.details?.activePatrolSessionId;
          if (conflictActiveId && itemOfflineId) {
            await setSessionMapping(itemOfflineId, conflictActiveId);
            sessionMappings[itemOfflineId] = conflictActiveId;
            await setSessionMapping('temp-active-session', conflictActiveId);
            sessionMappings['temp-active-session'] = conflictActiveId;
            console.log(`[OfflineSyncEngine] 409 Conflict captured active session ID: ${conflictActiveId}`);
          }
          console.warn(`[OfflineSyncEngine] Conflict (409) for item ${item.id}. Discarding item to unblock queue.`);
          await dequeue(item.id);
        } else if (
          statusCode === 400 &&
          errMsg.includes('No active patrol session') &&
          itemOfflineId &&
          !sessionMappings[itemOfflineId]
        ) {
          // Dependency timing issue during offline replay: do not mark fatal permanently
          console.warn(`[OfflineSyncEngine] 400 Session Dependency issue for ${item.id}. Re-queuing as pending.`);
          await updateMutationStatus(item.id, 'pending', `Waiting for session mapping: ${errMsg}`, false);
          break; // Stop replaying sequence
        } else if (statusCode >= 400 && statusCode < 500 && statusCode !== 408) {
          // Fatal Client Error: 400 Bad Request, 422 Validation
          await updateMutationStatus(item.id, 'failed', `Fatal Client Error (${statusCode}): ${errMsg}`, false);
          break; // Stop replaying sequence to preserve operations order
        } else {
          // Transient Network/Server Error (5xx, timeouts)
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
