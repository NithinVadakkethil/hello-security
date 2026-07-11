import { create } from 'zustand';
import { sqliteDb } from '../database/sqlite-db';

export interface OfflineMutation {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data: any;
  createdAt: number;
}

interface OfflineState {
  isConnected: boolean;
  queue: OfflineMutation[];
  setConnected: (connected: boolean) => void;
  loadQueue: () => Promise<void>;
  enqueue: (url: string, method: OfflineMutation['method'], data: any) => Promise<void>;
  dequeue: (id: string) => Promise<void>;
  clearQueue: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isConnected: true,
  queue: [],

  setConnected: (connected) => set({ isConnected: connected }),

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
}));
