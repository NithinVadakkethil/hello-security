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
      clientInfo,
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

      clientId
        ? prisma.client.findUnique({
            where: { id: clientId },
            select: {
              companyName: true,
              clientLogoUrl: true,
              dashboardImageUrl: true,
              dashboardImageAspectRatio: true,
              dashboardImageOrientation: true,
              dashboardImageFocalPosition: true,
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      employees,
      sites,
      gates,
      shifts,
      routes,
      assignments,
      activePatrols,
      clientBranding: clientInfo
        ? {
            companyName: clientInfo.companyName,
            clientLogoUrl: clientInfo.clientLogoUrl,
            dashboardImageUrl: clientInfo.dashboardImageUrl,
            dashboardImageAspectRatio: clientInfo.dashboardImageAspectRatio,
            dashboardImageOrientation: clientInfo.dashboardImageOrientation || 'LANDSCAPE',
            dashboardImageFocalPosition: clientInfo.dashboardImageFocalPosition || 'center',
          }
        : null,
    };
  }

  async getSuperAdminStats() {
    const [
      totalClients,
      activeClients,
      trialClients,
      expiredClients,
      suspendedClients,
      recentClients,
      latestLogs,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { isActive: true } }),
      prisma.client.count({ where: { subscriptionStatus: 'TRIAL' } }),
      prisma.client.count({ where: { subscriptionStatus: 'EXPIRED' } }),
      prisma.client.count({ where: { subscriptionStatus: 'SUSPENDED' } }),
      prisma.client.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true } },
          client: { select: { companyName: true } },
        },
      }),
    ]);

    return {
      totalClients,
      activeClients,
      trialClients,
      expiredClients,
      suspendedClients,
      recentClients,
      latestLogs,
    };
  }
}

export const dashboardRepository = new DashboardRepository();
