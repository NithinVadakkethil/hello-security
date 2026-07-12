import { apiClient } from '../../../app/api/api-client';
import { DashboardCounts, Site, Employee, PatrolSession } from '../types';

export const dashboardApi = {
  getCounts: async (): Promise<DashboardCounts> => {
    const res = (await apiClient.get('/dashboard')) as any;
    return res.data;
  },
  getCurrentPatrolSession: async (): Promise<PatrolSession | null> => {
    const res = (await apiClient.get('/patrol-sessions/current')) as any;
    return res.data;
  },
  getPatrolHistory: async (): Promise<PatrolSession[]> => {
    const res = (await apiClient.get('/patrol-sessions/history')) as any;
    return res.data;
  },
  getSites: async (): Promise<Site[]> => {
    const res = (await apiClient.get('/sites')) as any;
    return res.data;
  },
  getEmployees: async (): Promise<Employee[]> => {
    const res = (await apiClient.get('/employees')) as any;
    return res.data;
  },
};
