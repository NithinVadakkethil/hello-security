import { dashboardRepository } from './dashboard.repository';

export class DashboardService {
  async get(clientId: string) {
    return dashboardRepository.getCounts(clientId);
  }
}

export const dashboardService = new DashboardService();
