import { apiClient } from '../../../app/api/api-client';
import { GuardAssignment } from '../../dashboard/types';

export const assignmentApi = {
  getActiveAssignment: async (): Promise<GuardAssignment | null> => {
    try {
      const res = (await apiClient.get('/assignments/active')) as any;
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      throw err;
    }
  },
};
