import { apiClient } from '../../../app/api/api-client';
import { PatrolSession } from '../../dashboard/types';

export const patrolApi = {
  startPatrol: async (): Promise<PatrolSession> => {
    const res = (await apiClient.post('/patrol-sessions/start', {})) as any;
    return res.data;
  },

  pausePatrol: async (id: string): Promise<PatrolSession> => {
    const res = (await apiClient.patch(`/patrol-sessions/${id}/pause`, {})) as any;
    return res.data;
  },

  resumePatrol: async (id: string): Promise<PatrolSession> => {
    const res = (await apiClient.patch(`/patrol-sessions/${id}/resume`, {})) as any;
    return res.data;
  },

  completePatrol: async (id: string, remarks?: string): Promise<PatrolSession> => {
    const res = (await apiClient.patch(`/patrol-sessions/${id}/complete`, { remarks })) as any;
    return res.data;
  },

  scanCheckpoint: async (gateId: string, remarks?: string, latitude?: number, longitude?: number): Promise<any> => {
    const res = (await apiClient.post('/patrol-checkpoints/scan', {
      gateId,
      remarks,
      latitude,
      longitude,
    })) as any;
    return res.data;
  },
};
