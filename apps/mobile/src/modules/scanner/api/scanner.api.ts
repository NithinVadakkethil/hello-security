import { apiClient } from '../../../app/api/api-client';

export const scannerApi = {
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
