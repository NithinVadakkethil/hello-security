import { create } from 'zustand';
import { sqliteDb } from '../database/sqlite-db';

export interface OfflineMutation {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data: any;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  lastError?: string;
  conflictStrategy?: 'server_wins' | 'client_wins';
}

interface OfflineState {
  isConnected: boolean;
  queue: OfflineMutation[];
  isSyncing: boolean;
  lastSyncTime: number | null;
  setConnected: (connected: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
  loadQueue: () => Promise<void>;
  enqueue: (url: string, method: OfflineMutation['method'], data: any) => Promise<void>;
  dequeue: (id: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  updateMutationStatus: (
    id: string,
    status: OfflineMutation['status'],
    error?: string,
    incrementRetry?: boolean
  ) => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isConnected: true,
  queue: [],
  isSyncing: false,
  lastSyncTime: null,

  setConnected: (connected) => set({ isConnected: connected }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  loadQueue: async () => {
    const cached = await sqliteDb.list<OfflineMutation>('offline_mutations');
    set({ queue: cached.sort((a, b) => a.createdAt - b.createdAt) });
  },

  enqueue: async (url, method, data) => {
    const id = Math.random().toString(36).substring(7);
    const mutation: OfflineMutation = {
      id,
      url,
      method,
      data,
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    };
    await sqliteDb.insert('offline_mutations', id, mutation);
    set((state) => ({ queue: [...state.queue, mutation] }));
  },

  enqueueMutation: async (item: { url: string; method: OfflineMutation['method']; payload: any; mutationType?: string }) => {
    const id = Math.random().toString(36).substring(7);
    const mutation: OfflineMutation = {
      id,
      url: item.url,
      method: item.method,
      data: item.payload,
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    };
    await sqliteDb.insert('offline_mutations', id, mutation);
    set((state) => ({ queue: [...state.queue, mutation] }));
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
}));
