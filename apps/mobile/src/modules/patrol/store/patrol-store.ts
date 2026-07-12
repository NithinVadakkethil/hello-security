import { create } from 'zustand';
import { sqliteDb } from '../../../app/database/sqlite-db';
import { PatrolSession } from '../../dashboard/types';

interface PatrolState {
  activeSession: PatrolSession | null;
  scannedGateIds: string[];
  elapsedSeconds: number;
  unlockedGateId: string | null; // Currently unlocked gate ID (QR code scanned successfully)
  
  loadActiveSession: () => Promise<void>;
  startSession: (session: PatrolSession) => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  scanGate: (gateId: string) => Promise<void>;
  completeSession: () => Promise<void>;
  unlockCheckpoint: (gateId: string) => void;
  lockCheckpoint: () => void;
  tick: () => void;
}

export const usePatrolStore = create<PatrolState>((set, get) => ({
  activeSession: null,
  scannedGateIds: [],
  elapsedSeconds: 0,
  unlockedGateId: null,

  loadActiveSession: async () => {
    const cachedSession = await sqliteDb.get<PatrolSession>('patrols', 'current');
    const cachedScanned = await sqliteDb.get<string[]>('checkpoints', 'current_scanned');
    const cachedUnlocked = await sqliteDb.get<string>('checkpoints', 'current_unlocked');
    
    if (cachedSession) {
      const elapsed = Math.floor((Date.now() - new Date(cachedSession.startedAt).getTime()) / 1000);
      set({
        activeSession: cachedSession,
        scannedGateIds: cachedScanned || [],
        unlockedGateId: cachedUnlocked || null,
        elapsedSeconds: elapsed > 0 ? elapsed : 0,
      });
    } else {
      set({ activeSession: null, scannedGateIds: [], unlockedGateId: null, elapsedSeconds: 0 });
    }
  },

  startSession: async (session) => {
    await sqliteDb.insert('patrols', 'current', session);
    await sqliteDb.insert('checkpoints', 'current_scanned', []);
    await sqliteDb.insert('checkpoints', 'current_unlocked', null);
    set({ activeSession: session, scannedGateIds: [], unlockedGateId: null, elapsedSeconds: 0 });
  },

  pauseSession: async () => {
    const { activeSession } = get();
    if (!activeSession) return;
    
    const updated = {
      ...activeSession,
      status: 'PAUSED' as const,
      pauseCount: activeSession.pauseCount + 1,
    };
    await sqliteDb.insert('patrols', 'current', updated);
    set({ activeSession: updated });
  },

  resumeSession: async () => {
    const { activeSession } = get();
    if (!activeSession) return;
    
    const updated = {
      ...activeSession,
      status: 'IN_PROGRESS' as const,
    };
    await sqliteDb.insert('patrols', 'current', updated);
    set({ activeSession: updated });
  },

  scanGate: async (gateId) => {
    const { scannedGateIds } = get();
    if (scannedGateIds.includes(gateId)) return;

    const updated = [...scannedGateIds, gateId];
    await sqliteDb.insert('checkpoints', 'current_scanned', updated);
    await sqliteDb.insert('checkpoints', 'current_unlocked', null);
    set({ scannedGateIds: updated, unlockedGateId: null }); // Locks checkpoint immediately after successful scan submission
  },

  completeSession: async () => {
    await sqliteDb.delete('patrols', 'current');
    await sqliteDb.delete('checkpoints', 'current_scanned');
    await sqliteDb.delete('checkpoints', 'current_unlocked');
    set({ activeSession: null, scannedGateIds: [], unlockedGateId: null, elapsedSeconds: 0 });
  },

  unlockCheckpoint: async (gateId) => {
    await sqliteDb.insert('checkpoints', 'current_unlocked', gateId);
    set({ unlockedGateId: gateId });
  },

  lockCheckpoint: async () => {
    await sqliteDb.insert('checkpoints', 'current_unlocked', null);
    set({ unlockedGateId: null });
  },

  tick: () => {
    const { activeSession } = get();
    if (activeSession && activeSession.status === 'IN_PROGRESS') {
      set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
    }
  },
}));
