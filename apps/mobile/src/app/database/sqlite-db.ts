import { storage } from '../utils/mmkv-storage';

// Local offline DB caching layer using MMKV as the synchronous key-value backup
// and preparing interface for native SQLite (react-native-sqlite-storage / op-sqlite)
export interface OfflineTableRecord {
  id: string;
  table: 'checkpoints' | 'patrols' | 'assignments' | 'offline_mutations';
  data: string; // JSON string payload
  createdAt: number;
}

export const sqliteDb = {
  // Simulates table initialization
  init: async (): Promise<boolean> => {
    return true;
  },

  // Inserts or replaces a record in local cache
  insert: async (table: string, id: string, data: any): Promise<boolean> => {
    try {
      const key = `db:${table}:${id}`;
      storage.set(key, JSON.stringify({
        id,
        table,
        data: JSON.stringify(data),
        createdAt: Date.now(),
      }));
      return true;
    } catch (err) {
      console.error('[SQLite DB] Insert error:', err);
      return false;
    }
  },

  // Gets a single record from cache
  get: async <T>(table: string, id: string): Promise<T | null> => {
    try {
      const key = `db:${table}:${id}`;
      const value = storage.getString(key);
      if (!value) return null;
      const record = JSON.parse(value) as OfflineTableRecord;
      return JSON.parse(record.data) as T;
    } catch {
      return null;
    }
  },

  // Lists all records in a table
  list: async <T>(table: string): Promise<T[]> => {
    try {
      const allKeys = storage.getAllKeys();
      const tablePrefix = `db:${table}:`;
      const tableKeys = allKeys.filter((k) => k.startsWith(tablePrefix));

      const records: T[] = [];
      for (const key of tableKeys) {
        const val = storage.getString(key);
        if (val) {
          const rec = JSON.parse(val) as OfflineTableRecord;
          records.push(JSON.parse(rec.data) as T);
        }
      }
      return records;
    } catch (err) {
      console.error('[SQLite DB] List error:', err);
      return [];
    }
  },

  // Deletes a single record
  delete: async (table: string, id: string): Promise<boolean> => {
    try {
      const key = `db:${table}:${id}`;
      storage.delete(key);
      return true;
    } catch {
      return false;
    }
  },

  // Clears all records in a table
  clearTable: async (table: string): Promise<boolean> => {
    try {
      const allKeys = storage.getAllKeys();
      const tablePrefix = `db:${table}:`;
      const tableKeys = allKeys.filter((k) => k.startsWith(tablePrefix));
      tableKeys.forEach((key) => storage.delete(key));
      return true;
    } catch {
      return false;
    }
  },
};
