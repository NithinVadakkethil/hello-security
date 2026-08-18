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
  getMyAssignments: async (): Promise<any[]> => {
    const res = (await apiClient.get('/assignments/my-assignments')) as any;
    return res.data;
  },
  getPatrolDetail: async (patrolId: string): Promise<any> => {
    const res = (await apiClient.get(`/patrol-sessions/${patrolId}`)) as any;
    return res.data;
  },
  verifyPatrolSession: async (patrolId: string, data: { verificationStatus: 'VERIFIED' | 'NOT_VERIFIED'; supervisorRemarks?: string }): Promise<any> => {
    const res = (await apiClient.patch(`/patrol-sessions/${patrolId}/verify`, data)) as any;
    return res.data;
  },
  updateCheckpointRemarks: async (checkpointId: string, remarks: string): Promise<any> => {
    const res = (await apiClient.patch(`/patrol-checkpoints/${checkpointId}/remarks`, { remarks })) as any;
    return res.data;
  },
  getPatrolReviews: async (params?: {
    filter?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: any[]; total: number; totalPages: number }> => {
    const res = (await apiClient.get('/patrol-sessions', { params })) as any;
    const items = res.data?.items || res.data || [];
    const pagination = res.pagination || {
      total: items.length,
      page: params?.page || 1,
      totalPages: 1,
    };
    return {
      items,
      total: pagination.total,
      totalPages: pagination.totalPages,
    };
  },
};
