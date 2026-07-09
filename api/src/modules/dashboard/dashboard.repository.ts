import { prisma } from '../../database/prisma';

export class DashboardRepository {
  async getCounts(clientId?: string) {
    const [
      employees,
      sites,
      gates,
      shifts,
      routes,
      assignments,
      activePatrols,
    ] = await Promise.all([
      prisma.employee.count({
        where: {
          ...(clientId && { clientId }),
          status: 'ACTIVE',
        },
      }),

      prisma.site.count({
        where: {
          ...(clientId && { clientId }),
          isActive: true,
        },
      }),

      prisma.gate.count({
        where: {
          ...(clientId && {
            site: {
              clientId,
            },
          }),
          isActive: true,
        },
      }),

      prisma.shift.count({
        where: {
          ...(clientId && { clientId }),
          isActive: true,
        },
      }),

      prisma.patrolRoute.count({
        where: {
          ...(clientId && { clientId }),
          isActive: true,
        },
      }),

      prisma.guardAssignment.count({
        where: {
          ...(clientId && { clientId }),
          isActive: true,
        },
      }),

      prisma.patrolSession.count({
        where: {
          ...(clientId && { clientId }),
          status: 'IN_PROGRESS',
        },
      }),
    ]);

    return {
      employees,
      sites,
      gates,
      shifts,
      routes,
      assignments,
      activePatrols,
    };
  }
}

export const dashboardRepository = new DashboardRepository();
