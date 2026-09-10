import { create } from 'zustand';

export interface ManagerClient {
  clientId: string;
  clientCode: string;
  companyName: string;
  clientLogoUrl?: string | null;
  siteCount: number;
}

interface ManagerState {
  activeClient: ManagerClient | null;
  assignedClients: ManagerClient[];
  setActiveClient: (client: ManagerClient | null) => void;
  setAssignedClients: (clients: ManagerClient[]) => void;
  clearManagerStore: () => void;
}

export const useManagerStore = create<ManagerState>((set) => ({
  activeClient: null,
  assignedClients: [],
  setActiveClient: (client) => set({ activeClient: client }),
  setAssignedClients: (clients) => set({ assignedClients: clients }),
  clearManagerStore: () => set({ activeClient: null, assignedClients: [] }),
}));
