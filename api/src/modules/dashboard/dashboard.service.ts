import { dashboardRepository } from './dashboard.repository';

export class DashboardService {
  async get(clientId?: string, isSuperAdmin = false) {
    if (isSuperAdmin || !clientId) {
      return dashboardRepository.getSuperAdminStats();
    }
    return dashboardRepository.getCounts(clientId);
  }
}

export const dashboardService = new DashboardService();
