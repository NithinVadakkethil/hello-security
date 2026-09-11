import { create } from 'zustand';
import { sqliteDb } from '../../../app/database/sqlite-db';
import { PatrolSession } from '../../dashboard/types';

interface PatrolState {
  activeSession: PatrolSession | null;
  scannedGateIds: string[];
  elapsedSeconds: number;
  unlockedGateId: string | null; // Currently unlocked gate ID (QR code scanned successfully)
  justScannedGateId: string | null; // Set ONLY after a fresh QR scan success, cleared after scroll
  
  loadActiveSession: () => Promise<void>;
  startSession: (session: PatrolSession) => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  scanGate: (gateId: string) => Promise<void>;
  completeSession: () => Promise<void>;
  unlockCheckpoint: (gateId: string) => void;
  lockCheckpoint: () => void;
  clearJustScannedGateId: () => void;
  tick: () => void;
}

export const usePatrolStore = create<PatrolState>((set, get) => ({
  activeSession: null,
  scannedGateIds: [],
  elapsedSeconds: 0,
  unlockedGateId: null,
  justScannedGateId: null,

  loadActiveSession: async () => {
    const cachedSession = await sqliteDb.get<PatrolSession>('patrols', 'current');
    const cachedScanned = await sqliteDb.get<string[]>('checkpoints', 'current_scanned');
    const cachedUnlocked = await sqliteDb.get<string>('checkpoints', 'current_unlocked');
    
    if (cachedSession) {
      const elapsed = Math.floor((Date.now() - new Date(cachedSession.startedAt).getTime()) / 1000);
      const serverScanned: string[] = Array.isArray((cachedSession as any)?.checkpoints)
        ? (cachedSession as any).checkpoints.map((cp: any) => cp.gateId || cp.gate?.id || cp.gate?.gateCode).filter(Boolean)
        : [];
      const mergedScanned = Array.from(new Set([...(cachedScanned || []), ...serverScanned]));

      set({
        activeSession: cachedSession,
        scannedGateIds: mergedScanned,
        unlockedGateId: cachedUnlocked || null,
        justScannedGateId: null,
        elapsedSeconds: elapsed > 0 ? elapsed : 0,
      });
    } else {
      set({ activeSession: null, scannedGateIds: [], unlockedGateId: null, justScannedGateId: null, elapsedSeconds: 0 });
    }
  },

  startSession: async (session) => {
    const { activeSession, scannedGateIds: prevScanned } = get();
    await sqliteDb.insert('patrols', 'current', session);

    const serverScanned: string[] = Array.isArray((session as any)?.checkpoints)
      ? (session as any).checkpoints.map((cp: any) => cp.gateId || cp.gate?.id || cp.gate?.gateCode).filter(Boolean)
      : [];

    const isSameSession = activeSession && activeSession.id === session.id;
    const mergedScanned = isSameSession
      ? Array.from(new Set([...prevScanned, ...serverScanned]))
      : Array.from(new Set(serverScanned));

    await sqliteDb.insert('checkpoints', 'current_scanned', mergedScanned);
    await sqliteDb.insert('checkpoints', 'current_unlocked', null);

    const elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);

    set({
      activeSession: session,
      scannedGateIds: mergedScanned,
      unlockedGateId: null,
      justScannedGateId: null,
      elapsedSeconds: isSameSession ? (get().elapsedSeconds || elapsed) : (elapsed > 0 ? elapsed : 0),
    });
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
    if (!gateId) return;
    const { scannedGateIds } = get();

    const updated = Array.from(new Set([...scannedGateIds, gateId]));
    await sqliteDb.insert('checkpoints', 'current_scanned', updated);
    await sqliteDb.insert('checkpoints', 'current_unlocked', null);
    set({ scannedGateIds: updated, unlockedGateId: null, justScannedGateId: null });
  },

  completeSession: async () => {
    await sqliteDb.delete('patrols', 'current');
    await sqliteDb.delete('checkpoints', 'current_scanned');
    await sqliteDb.delete('checkpoints', 'current_unlocked');
    set({ activeSession: null, scannedGateIds: [], unlockedGateId: null, justScannedGateId: null, elapsedSeconds: 0 });
  },

  unlockCheckpoint: async (gateId) => {
    await sqliteDb.insert('checkpoints', 'current_unlocked', gateId);
    set({ unlockedGateId: gateId, justScannedGateId: gateId });
  },

  lockCheckpoint: async () => {
    await sqliteDb.insert('checkpoints', 'current_unlocked', null);
    set({ unlockedGateId: null, justScannedGateId: null });
  },

  clearJustScannedGateId: () => {
    set({ justScannedGateId: null });
  },

  tick: () => {
    const { activeSession } = get();
    if (activeSession && activeSession.status === 'IN_PROGRESS') {
      set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
    }
  },
}));
