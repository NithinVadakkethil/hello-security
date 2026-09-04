import { apiClient } from '../../../app/api/api-client';
import { PatrolSession } from '../../dashboard/types';

export const patrolApi = {
  startPatrol: async (assignmentId?: string, resolveExistingPatrol?: boolean, startedAt?: string): Promise<PatrolSession> => {
    const res = (await apiClient.post('/patrol-sessions/start', { assignmentId, resolveExistingPatrol, startedAt })) as any;
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

  completePatrol: async (id: string, remarks?: string, endedAt?: string): Promise<PatrolSession> => {
    const res = (await apiClient.patch(`/patrol-sessions/${id}/complete`, { remarks, endedAt })) as any;
    return res.data;
  },

  cancelPatrol: async (id: string): Promise<any> => {
    const res = (await apiClient.post(`/patrol-sessions/${id}/cancel`, {})) as any;
    return res.data;
  },

  scanCheckpoint: async (
    gateId: string,
    remarks?: string,
    status?: string,
    images?: string[],
    latitude?: number,
    longitude?: number,
    subTaskResponses?: Array<{ gateSubTaskId: string; answer: 'YES' | 'NO'; remarks?: string; images?: string[]; answeredAt?: string }>,
    patrolSessionId?: string,
    scannedAt?: string,
  ): Promise<any> => {
    const res = (await apiClient.post('/patrol-checkpoints/scan', {
      gateId,
      patrolSessionId,
      remarks,
      status,
      images,
      latitude,
      longitude,
      scannedAt,
      subTaskResponses,
    })) as any;
    return res.data;
  },
};
