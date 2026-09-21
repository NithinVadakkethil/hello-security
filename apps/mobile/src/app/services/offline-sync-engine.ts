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
  private syncPromise: Promise<void> | null = null;
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
    // Single-Flight Guard: If a sync execution is already in progress, return the existing Promise
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = this.executeSync();
    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  private async executeSync(): Promise<void> {
    const store = useOfflineStore.getState();
    const { isConnected, setSyncing, setLastSyncTime, dequeue, updateMutationStatus, setSessionMapping } = store;
    const { isAuthenticated, isLoading: isAuthLoading, user: currentUser } = useAuthStore.getState();
    const accessToken = tokenManager.getAccessToken();

    // Guard 1: Basic pre-conditions
    if (!isConnected || this.isLocked) {
      return;
    }

    // Refresh persistent queue & session mappings from storage
    await store.loadQueue();
    const queueSnapshot = useOfflineStore.getState().queue;

    if (queueSnapshot.length === 0) {
      return;
    }

    // Guard 2: Auth Hydration Guard
    if (isAuthLoading) {
      console.log('[OfflineSyncEngine] Auth state is still hydrating. Deferring sync.');
      return;
    }

    // Guard 3: Authentication & Token Guard
    if (!isAuthenticated || !accessToken || !currentUser) {
      console.log('[OfflineSyncEngine] User unauthenticated or token missing. Sync paused until login.');
      return;
    }

    this.isLocked = true;
    setSyncing(true);

    const sessionMappings = { ...useOfflineStore.getState().sessionMappings };
    console.log(`[OfflineSyncEngine] Initiating sync for ${queueSnapshot.length} items (Authenticated User: ${currentUser.email})...`);

    const attemptedThisRun = new Set<string>();

    try {
      // Process queue items using live state loop
      while (true) {
        const liveQueue = useOfflineStore.getState().queue;
        if (liveQueue.length === 0) break;

        // Find the next runnable mutation in liveQueue
        let itemToProcess: OfflineMutation | null = null;

        for (const item of liveQueue) {
          // Do not retry items attempted during this single sync pass
          if (attemptedThisRun.has(item.id)) {
            continue;
          }

          // Skip items that exceeded max retries
          if (item.retryCount >= MAX_RETRIES) {
            continue;
          }

          // Guard 4: Queue Ownership & Tenant Guard — Only sync mutations belonging to current user & client
          if (item.isLegacyUnowned) {
            continue;
          }

          const itemOwnerUserId = item.ownerUserId || item.userId;
          const itemOwnerEmpId = item.ownerEmployeeId || item.employeeId;
          const currentUserEmpId = currentUser.employeeId || (currentUser as any)?.employee?.id;

          const isUserMatch =
            (itemOwnerUserId && itemOwnerUserId === currentUser.id) ||
            (itemOwnerEmpId && itemOwnerEmpId === currentUserEmpId);

          if (!isUserMatch) {
            continue;
          }

          const itemOwnerClientId = item.ownerClientId;
          const currentUserClientId = (currentUser as any)?.clientId || (currentUser as any)?.client?.id;
          if (itemOwnerClientId && currentUserClientId && itemOwnerClientId !== currentUserClientId) {
            continue;
          }

          // Determine correlation ID for this item (from property, payload, or URL path)
          let itemOfflineId =
            item.offlineSessionId ||
            item.data?.offlineSessionId ||
            item.data?.patrolSessionId;

          if (!itemOfflineId && item.url.includes('/patrol-sessions/')) {
            const urlParts = item.url.split('?')[0].split('/');
            const sessionIndex = urlParts.indexOf('patrol-sessions');
            if (sessionIndex !== -1 && urlParts[sessionIndex + 1] && urlParts[sessionIndex + 1] !== 'start') {
              itemOfflineId = urlParts[sessionIndex + 1];
            }
          }

          const isStartMutation = item.url.endsWith('/patrol-sessions/start');
          const isCompleteMutation = item.url.includes('/complete');
          const isScanMutation = item.url.includes('/patrol-checkpoints/scan');

          // Resolve server session ID if mapped
          let mappedServerSessionId = itemOfflineId ? sessionMappings[itemOfflineId] : undefined;

          // -------------------------------------------------------------
          // CROSS-SESSION DEPENDENCY GUARD (Per-Employee Sequential Execution)
          // A START mutation for an offline session CANNOT run if ANY earlier
          // offline session for the SAME employee has pending mutations in liveQueue.
          // -------------------------------------------------------------
          if (isStartMutation && itemOfflineId) {
            const hasEarlierUnfinishedSession = liveQueue.some((other) => {
              if (other.id === item.id) return false;
              let otherOfflineId = other.offlineSessionId || other.data?.offlineSessionId || other.data?.patrolSessionId;
              if (!otherOfflineId && other.url.includes('/patrol-sessions/')) {
                const uParts = other.url.split('?')[0].split('/');
                const sIdx = uParts.indexOf('patrol-sessions');
                if (sIdx !== -1 && uParts[sIdx + 1] && uParts[sIdx + 1] !== 'start') {
                  otherOfflineId = uParts[sIdx + 1];
                }
              }

              if (!otherOfflineId || otherOfflineId === itemOfflineId) return false;

              // Check if other belongs to the same employee
              const otherEmpId = other.ownerEmployeeId || other.employeeId;
              const matchesEmp = !otherEmpId || !itemOwnerEmpId || otherEmpId === itemOwnerEmpId;
              if (!matchesEmp) return false;

              // Earlier in queue order or created earlier
              const isEarlier =
                (other.createdAt < item.createdAt) ||
                (other.createdAt === item.createdAt && (other.sequence || 0) < (item.sequence || 0));

              return isEarlier;
            });

            if (hasEarlierUnfinishedSession) {
              console.log(
                `[OfflineSyncEngine] Start mutation ${item.id} (session ${itemOfflineId}) waiting for earlier offline session to finish syncing. Skipping for now.`
              );
              continue;
            }
          }

          // -------------------------------------------------------------
          // DEPENDENCY GUARD 1: SCAN/COMPLETE cannot proceed without START mapping
          // -------------------------------------------------------------
          if ((isScanMutation || isCompleteMutation) && itemOfflineId && !mappedServerSessionId) {
            const hasPendingStart = liveQueue.some(
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
          // DEPENDENCY GUARD 2: COMPLETE cannot proceed while ANY SCANS for THIS SAME session are pending in liveQueue
          // -------------------------------------------------------------
          if (isCompleteMutation) {
            const hasPendingScans = liveQueue.some((m) => {
              if (m.id === item.id) return false;
              if (!m.url.includes('/patrol-checkpoints/scan')) return false;

              let mOfflineId = m.offlineSessionId || m.data?.offlineSessionId || m.data?.patrolSessionId;
              if (itemOfflineId && mOfflineId) {
                return mOfflineId === itemOfflineId;
              }
              return true;
            });

            if (hasPendingScans) {
              console.log(`[OfflineSyncEngine] Complete mutation ${item.id} (session ${itemOfflineId}) waiting for pending scan mutations for the same session to sync first. Skipping.`);
              continue;
            }
          }

          itemToProcess = item;
          break; // Found the next eligible item
        }

        if (!itemToProcess) {
          // No remaining runnable items (queue empty or remaining items blocked by dependencies/retries)
          console.log('[OfflineSyncEngine] No further runnable items in queue for current sync pass. Exiting loop.');
          break;
        }

        const item = itemToProcess;
        attemptedThisRun.add(item.id);
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

          const itemOfflineId =
            item.offlineSessionId ||
            item.data?.offlineSessionId ||
            item.data?.patrolSessionId;

          const isStartMutation = item.url.endsWith('/patrol-sessions/start');
          const mappedServerSessionId = itemOfflineId ? sessionMappings[itemOfflineId] : undefined;

          // Replace local offline ID with server ID if mapping exists
          if (mappedServerSessionId && itemOfflineId) {
            url = url.replace(itemOfflineId, mappedServerSessionId);
            if (data && typeof data === 'object') {
              data = JSON.parse(
                JSON.stringify(data).replace(new RegExp(itemOfflineId, 'g'), mappedServerSessionId)
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

          // If patrol start succeeded, persist per-session mapping permanently
          if (isStartMutation && response?.data?.id) {
            const createdServerId = response.data.id;
            if (itemOfflineId) {
              await setSessionMapping(itemOfflineId, createdServerId);
              sessionMappings[itemOfflineId] = createdServerId;
            }

            // Update active patrol session in Zustand store if active locally
            const { activeSession, startSession } = usePatrolStore.getState();
            if (activeSession && activeSession.id === itemOfflineId) {
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
          const errCode = err.response?.data?.error?.code || err.response?.data?.code;

          console.warn(`[OfflineSyncEngine] Sync failure notice for item ${item.id} (${item.url}):`, errMsg);

          if (statusCode === 401 || statusCode === 403) {
            console.warn(`[OfflineSyncEngine] Auth block (${statusCode}) for item ${item.id}. Pausing sync until valid login.`);
            await updateMutationStatus(item.id, 'pending', `Auth Blocked (${statusCode}): ${errMsg}`, false);
            break; // Stop replaying sequence
          } else if (
            statusCode === 409 ||
            (statusCode === 400 && (errMsg.includes('already have a patrol in progress') || errCode === 'ACTIVE_PATROL_EXISTS'))
          ) {
            const conflictActiveId = err.response?.data?.error?.details?.activePatrolSessionId || err.response?.data?.details?.activePatrolSessionId;
            const itemOfflineId = item.offlineSessionId || item.data?.offlineSessionId || item.data?.patrolSessionId;

            // Check if this employee has an earlier offline session in queue that hasn't finished COMPLETE
            const currentQueue = useOfflineStore.getState().queue;
            const hasUnfinishedEarlierSession = currentQueue.some((other) => {
              if (other.id === item.id) return false;
              const otherOfflineId = other.offlineSessionId || other.data?.offlineSessionId || other.data?.patrolSessionId;
              return otherOfflineId && otherOfflineId !== itemOfflineId;
            });

            if (hasUnfinishedEarlierSession) {
              console.warn(`[OfflineSyncEngine] 400/409 Session Conflict: Previous offline patrol still syncing. Re-queuing item ${item.id} as pending.`);
              await updateMutationStatus(item.id, 'pending', `Waiting for previous patrol completion: ${errMsg}`, false);
              break; // Stop loop to let earlier patrol complete first
            } else if (conflictActiveId && itemOfflineId) {
              // Recover server session ID created on a previous START attempt
              await setSessionMapping(itemOfflineId, conflictActiveId);
              sessionMappings[itemOfflineId] = conflictActiveId;
              console.log(`[OfflineSyncEngine] Recovered active session ID ${conflictActiveId} for ${itemOfflineId}. Dequeuing duplicate START.`);
              await dequeue(item.id);
            } else {
              console.warn(`[OfflineSyncEngine] 400/409 Conflict for item ${item.id}. Re-queuing as pending.`);
              await updateMutationStatus(item.id, 'pending', `Session conflict: ${errMsg}`, false);
              break;
            }
          } else if (
            statusCode === 400 &&
            errMsg.includes('No active patrol session')
          ) {
            console.warn(`[OfflineSyncEngine] 400 Session Dependency issue for ${item.id}. Re-queuing as pending.`);
            await updateMutationStatus(item.id, 'pending', `Waiting for session: ${errMsg}`, false);
            break; // Stop replaying sequence
          } else if (statusCode >= 400 && statusCode < 500 && statusCode !== 408) {
            // Fatal Client Error: 400 Bad Request, 422 Validation
            await updateMutationStatus(item.id, 'failed', `Fatal Client Error (${statusCode}): ${errMsg}`, false);
            break; // Stop replaying sequence
          } else {
            // Transient Network/Server Error (5xx, timeouts)
            await updateMutationStatus(item.id, 'failed', `Transient Error: ${errMsg}`, true);
            break; // Stop replaying sequence
          }
        }
      }
    } finally {
      setSyncing(false);
      setLastSyncTime(Date.now());
      this.isLocked = false;

      if (this.queryClient) {
        this.queryClient.invalidateQueries();
      }
    }
  }
}

export const offlineSyncEngine = OfflineSyncEngine.getInstance();
