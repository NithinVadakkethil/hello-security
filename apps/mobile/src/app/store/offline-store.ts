import { create } from 'zustand';
import { sqliteDb } from '../database/sqlite-db';
import { useAuthStore } from './auth-store';

export interface OfflineMutation {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data: any;
  createdAt: number;
  sequence?: number;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  lastError?: string;
  conflictStrategy?: 'server_wins' | 'client_wins';
  offlineSessionId?: string;

  // Stable Backend Ownership Metadata
  ownerUserId?: string;
  ownerEmployeeId?: string;
  ownerClientId?: string;

  // Legacy Migration Flag
  isLegacyUnowned?: boolean;

  // Deprecated fields kept for backward compatibility during migration
  userId?: string;
  employeeId?: string;
}

interface OfflineState {
  isConnected: boolean;
  queue: OfflineMutation[];
  sessionMappings: Record<string, string>;
  isSyncing: boolean;
  lastSyncTime: number | null;
  setConnected: (connected: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
  loadQueue: () => Promise<void>;
  enqueue: (url: string, method: OfflineMutation['method'], data: any, offlineSessionId?: string) => Promise<void>;
  dequeue: (id: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  updateMutationStatus: (
    id: string,
    status: OfflineMutation['status'],
    error?: string,
    incrementRetry?: boolean
  ) => Promise<void>;
  setSessionMapping: (offlineSessionId: string, serverSessionId: string) => Promise<void>;
  getSessionMapping: (offlineSessionId: string) => string | undefined;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isConnected: true,
  queue: [],
  sessionMappings: {},
  isSyncing: false,
  lastSyncTime: null,

  setConnected: (connected) => set({ isConnected: connected }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  loadQueue: async () => {
    const cachedQueue = await sqliteDb.list<OfflineMutation>('offline_mutations');
    const cachedMappings = await sqliteDb.list<{ id: string; offlineSessionId: string; serverSessionId: string }>('session_mappings');
    const currentUser = useAuthStore.getState().user;

    const mappingsObj: Record<string, string> = {};
    cachedMappings.forEach((m) => {
      if (m.offlineSessionId && m.serverSessionId) {
        mappingsObj[m.offlineSessionId] = m.serverSessionId;
      }
    });

    // Migrate legacy records if missing ownership metadata
    for (const item of cachedQueue) {
      let updated = false;

      // Legacy Migration for known session cmtvi1yll0007utceh4fbuic5 (belonging to nithin@manager.com)
      const isLegacyNithinSession =
        item.offlineSessionId === 'cmtvi1yll0007utceh4fbuic5' ||
        item.data?.patrolSessionId === 'cmtvi1yll0007utceh4fbuic5' ||
        item.url.includes('cmtvi1yll0007utceh4fbuic5');

      if (!item.ownerUserId && !item.ownerEmployeeId) {
        if (isLegacyNithinSession) {
          item.ownerUserId = 'cmtstkt420003utw4srq56hy0';
          item.ownerEmployeeId = 'cmtstkt3k0001utw4wh7o8xjt';
          item.ownerClientId = 'cmsebft25003kut9jpscbw2dg';
          updated = true;
        } else if (item.userId || item.employeeId) {
          item.ownerUserId = item.userId;
          item.ownerEmployeeId = item.employeeId;
          updated = true;
        } else {
          item.isLegacyUnowned = true;
          updated = true;
        }
      }

      if (updated) {
        await sqliteDb.insert('offline_mutations', item.id, item);
      }
    }

    // Filter queue so that only mutations belonging to the current user are loaded into state
    const userScopedQueue = cachedQueue.filter((item) => {
      if (!currentUser) return false;

      // If unowned legacy item, do not expose to any user
      if (item.isLegacyUnowned) return false;

      const matchesUserId = item.ownerUserId && item.ownerUserId === currentUser.id;
      const matchesEmployeeId =
        item.ownerEmployeeId &&
        (item.ownerEmployeeId === currentUser.employeeId || item.ownerEmployeeId === (currentUser as any)?.employee?.id);

      return matchesUserId || matchesEmployeeId;
    });

    const sortedQueue = userScopedQueue.sort((a, b) =>
      a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : (a.sequence || 0) - (b.sequence || 0)
    );

    set({ queue: sortedQueue, sessionMappings: mappingsObj });
  },

  enqueue: async (url, method, data, offlineSessionId?) => {
    const id = Math.random().toString(36).substring(7);
    const resolvedOfflineId =
      offlineSessionId ||
      data?.offlineSessionId ||
      data?.patrolSessionId ||
      (url.includes('temp-active-session') ? 'temp-active-session' : undefined);

    const now = Date.now();
    const currentQueue = get().queue;
    const lastSeq = currentQueue.length > 0 ? (currentQueue[currentQueue.length - 1].sequence || 0) + 1 : 1;
    const currentUser = useAuthStore.getState().user;

    const ownerUserId = currentUser?.id;
    const ownerEmployeeId = currentUser?.employeeId || (currentUser as any)?.employee?.id;
    const ownerClientId = (currentUser as any)?.clientId || (currentUser as any)?.client?.id;

    const mutation: OfflineMutation = {
      id,
      url,
      method,
      data,
      createdAt: now,
      sequence: lastSeq,
      status: 'pending',
      retryCount: 0,
      offlineSessionId: resolvedOfflineId,
      ownerUserId,
      ownerEmployeeId,
      ownerClientId,
      userId: ownerUserId,
      employeeId: ownerEmployeeId,
    };

    await sqliteDb.insert('offline_mutations', id, mutation);
    set((state) => ({
      queue: [...state.queue, mutation].sort((a, b) =>
        a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : (a.sequence || 0) - (b.sequence || 0)
      ),
    }));
  },

  enqueueMutation: async (item: { url: string; method: OfflineMutation['method']; payload: any; mutationType?: string; offlineSessionId?: string }) => {
    const id = Math.random().toString(36).substring(7);
    const now = Date.now();
    const currentQueue = get().queue;
    const lastSeq = currentQueue.length > 0 ? (currentQueue[currentQueue.length - 1].sequence || 0) + 1 : 1;
    const currentUser = useAuthStore.getState().user;

    const ownerUserId = currentUser?.id;
    const ownerEmployeeId = currentUser?.employeeId || (currentUser as any)?.employee?.id;
    const ownerClientId = (currentUser as any)?.clientId || (currentUser as any)?.client?.id;

    const mutation: OfflineMutation = {
      id,
      url: item.url,
      method: item.method,
      data: item.payload,
      createdAt: now,
      sequence: lastSeq,
      status: 'pending',
      retryCount: 0,
      offlineSessionId: item.offlineSessionId || item.payload?.offlineSessionId || item.payload?.patrolSessionId,
      ownerUserId,
      ownerEmployeeId,
      ownerClientId,
      userId: ownerUserId,
      employeeId: ownerEmployeeId,
    };

    await sqliteDb.insert('offline_mutations', id, mutation);
    set((state) => ({
      queue: [...state.queue, mutation].sort((a, b) =>
        a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : (a.sequence || 0) - (b.sequence || 0)
      ),
    }));
  },

  dequeue: async (id) => {
    await sqliteDb.delete('offline_mutations', id);
    set((state) => ({ queue: state.queue.filter((m) => m.id !== id) }));
  },

  clearQueue: async () => {
    await sqliteDb.clearTable('offline_mutations');
    set({ queue: [] });
  },

  updateMutationStatus: async (id, status, error, incrementRetry) => {
    const { queue } = get();
    const item = queue.find((m) => m.id === id);
    if (!item) return;

    const updated: OfflineMutation = {
      ...item,
      status,
      lastError: error,
      retryCount: incrementRetry ? item.retryCount + 1 : item.retryCount,
    };

    await sqliteDb.insert('offline_mutations', id, updated);
    set((state) => ({
      queue: state.queue.map((m) => (m.id === id ? updated : m)),
    }));
  },

  setSessionMapping: async (offlineSessionId, serverSessionId) => {
    if (!offlineSessionId || !serverSessionId) return;
    await sqliteDb.insert('session_mappings', offlineSessionId, {
      id: offlineSessionId,
      offlineSessionId,
      serverSessionId,
      createdAt: Date.now(),
    });
    set((state) => ({
      sessionMappings: {
        ...state.sessionMappings,
        [offlineSessionId]: serverSessionId,
      },
    }));
  },

  getSessionMapping: (offlineSessionId) => {
    return get().sessionMappings[offlineSessionId];
  },
}));
