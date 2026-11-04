import { centralManagerService } from '../central-manager.service';
import { prisma } from '../../../database/prisma';
import * as centralAuth from '../../../common/auth/central-manager-auth';

jest.mock('../../../common/auth/central-manager-auth');

describe('CentralManagerService - Dashboard Checkpoints KPI and All-Time Aggregations', () => {
  const mockUser = {
    id: 'user-cm-1',
    role: 'CENTRAL_COMMUNITY_MANAGER',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('aggregates total configured checkpoints across all authorized clients and for selected client', async () => {
      (centralAuth.assertCentralManagerClientAccess as jest.Mock).mockResolvedValue([
        'client-1',
        'client-2',
      ]);

      const mockClients = [
        {
          id: 'client-1',
          companyName: 'Atlabs Demo',
          clientCode: 'ATL-001',
          clientLogoUrl: null,
          dashboardImageUrl: null,
          address: 'Dubai, UAE',
          authorizedPerson: 'Admin',
          email: 'admin@atlabs.ae',
          phone: '+971500000000',
        },
        {
          id: 'client-2',
          companyName: 'Marina 101',
          clientCode: 'M101-002',
          clientLogoUrl: null,
          dashboardImageUrl: null,
          address: 'Marina, Dubai',
          authorizedPerson: 'Manager',
          email: 'manager@marina.ae',
          phone: '+971501111111',
        },
      ];

      jest.spyOn(prisma.client, 'findMany').mockResolvedValue(mockClients as any);
      jest.spyOn(prisma.site, 'count').mockResolvedValue(5 as any);
      jest.spyOn(prisma.employee, 'count').mockResolvedValue(30 as any);
      jest.spyOn(prisma.patrolSession, 'count').mockResolvedValue(100 as any);
      jest.spyOn(prisma.incident, 'count').mockResolvedValue(2 as any);
      jest.spyOn(prisma.snag, 'count').mockResolvedValue(4 as any);
      jest.spyOn(prisma.patrolSession, 'findMany').mockResolvedValue([] as any);
      jest.spyOn(prisma.incident, 'findMany').mockResolvedValue([] as any);
      jest.spyOn(prisma.snag, 'findMany').mockResolvedValue([] as any);
      jest.spyOn(prisma.snag, 'groupBy').mockResolvedValue([] as any);

      // Gate count spy:
      // 1st call: global totalConfiguredCheckpoints across authorized clients (client-1, client-2) -> 45
      // 2nd call: selected client checkpoints (client-1) -> 20
      const gateCountSpy = jest
        .spyOn(prisma.gate, 'count')
        .mockResolvedValueOnce(45)
        .mockResolvedValueOnce(20);

      const result = await centralManagerService.getDashboard(mockUser, {
        clientId: 'client-1',
      });

      expect(gateCountSpy).toHaveBeenCalledWith({
        where: {
          site: {
            clientId: { in: ['client-1', 'client-2'] },
          },
        },
      });

      expect(gateCountSpy).toHaveBeenCalledWith({
        where: {
          site: {
            clientId: 'client-1',
          },
        },
      });

      // Global verification
      expect(result.global.totalCheckpoints).toBe(45);
      expect(result.global.totalConfiguredCheckpoints).toBe(45);

      // Selected client metrics verification
      expect(result.selectedClient).toBeDefined();
      expect(result.selectedClient?.metrics.totalCheckpoints).toBe(20);
      expect(result.selectedClient?.metrics.totalConfiguredCheckpoints).toBe(20);
    });

    it('returns 0 for totalCheckpoints when no clients are assigned to manager', async () => {
      (centralAuth.assertCentralManagerClientAccess as jest.Mock).mockResolvedValue([]);
      jest.spyOn(prisma.client, 'findMany').mockResolvedValue([] as any);

      const result = await centralManagerService.getDashboard(mockUser, {});

      expect(result.global.totalCheckpoints).toBe(0);
      expect(result.global.totalConfiguredCheckpoints).toBe(0);
      expect(result.selectedClient).toBeNull();
    });
  });

  describe('getClientDashboard', () => {
    it('returns totalCheckpoints and totalConfiguredCheckpoints for single client view', async () => {
      (centralAuth.assertCentralManagerClientAccess as jest.Mock).mockResolvedValue([
        'client-1',
      ]);

      const mockClient = {
        id: 'client-1',
        companyName: 'Atlabs Demo',
        clientCode: 'ATL-001',
        sites: [{ id: 'site-1', name: 'Main Tower', isActive: true }],
      };

      jest.spyOn(prisma.client, 'findUnique').mockResolvedValue(mockClient as any);
      jest.spyOn(prisma.employee, 'count').mockResolvedValue(12 as any);
      jest.spyOn(prisma.patrolSession, 'count').mockResolvedValue(50 as any);
      jest.spyOn(prisma.incident, 'count').mockResolvedValue(1 as any);
      jest.spyOn(prisma.snag, 'count').mockResolvedValue(3 as any);
      jest.spyOn(prisma.snag, 'groupBy').mockResolvedValue([] as any);
      jest.spyOn(prisma.patrolSession, 'findMany').mockResolvedValue([] as any);
      jest.spyOn(prisma.incident, 'findMany').mockResolvedValue([] as any);
      jest.spyOn(prisma.snag, 'findMany').mockResolvedValue([] as any);

      jest.spyOn(prisma.gate, 'count').mockResolvedValue(18);

      const result = await centralManagerService.getClientDashboard(
        mockUser,
        'client-1',
        {}
      );

      expect(prisma.gate.count).toHaveBeenCalledWith({
        where: {
          site: { clientId: 'client-1' },
        },
      });

      expect(result.metrics.totalCheckpoints).toBe(18);
      expect(result.metrics.totalConfiguredCheckpoints).toBe(18);
    });
  });
});

