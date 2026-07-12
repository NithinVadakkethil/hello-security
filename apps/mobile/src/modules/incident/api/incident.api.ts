import { apiClient } from '../../../app/api/api-client';

export interface IncidentInput {
  type: string;
  severity: string;
  description: string;
  images?: string[];
  patrolSessionId?: string;
  gateId?: string;
  latitude?: number;
  longitude?: number;
}

export const incidentApi = {
  createIncident: async (data: IncidentInput | FormData): Promise<any> => {
    const isFormData = data instanceof FormData;
    const res = (await apiClient.post('/incidents', data, {
      headers: {
        'Content-Type': isFormData ? 'multipart/form-data' : 'application/json',
      },
    })) as any;
    return res.data;
  },

  getIncidents: async (): Promise<any[]> => {
    const res = (await apiClient.get('/incidents')) as any;
    return res.data;
  },
};
