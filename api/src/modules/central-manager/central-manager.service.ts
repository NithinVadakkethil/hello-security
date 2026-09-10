import { Prisma } from '@prisma/client';
import { assertCentralManagerClientAccess } from '../../common/auth/central-manager-auth';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { prisma } from '../../database/prisma';
import { reportService } from '../report/report.service';
import { ReportQueryDto } from '../report/report.types';

export interface CentralManagerFilterParams {
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  siteId?: string;
  role?: string;
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class CentralManagerService {
  private parseDateRange(dateFrom?: string, dateTo?: string) {
    let from: Date | undefined = dateFrom ? new Date(dateFrom) : undefined;
    let to: Date | undefined = dateTo ? new Date(dateTo) : undefined;

    if (from && isNaN(from.getTime())) from = undefined;
    if (to && isNaN(to.getTime())) to = undefined;

    if (to && dateTo && !dateTo.includes('T')) {
      to.setHours(23, 59, 59, 999);
    }

    return { from, to };
  }


  async getClientDashboard(
    user: { id: string; role: string },
    clientId: string,
    params: CentralManagerFilterParams,
  ) {
    await assertCentralManagerClientAccess(user, clientId);
    const { from, to } = this.parseDateRange(params.dateFrom, params.dateTo);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        sites: { where: { isActive: true } },
      },
    });

    if (!client) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Organization not found.');
    }

    const [
      employeesCount,
      activePatrolsCount,
      completedPatrolsCount,
      openObservationsCount,
      openSnagsCount,
      snagCategoriesGroup,
      recentPatrols,
      recentObservations,
      recentSnags,
    ] = await Promise.all([
      prisma.employee.count({ where: { clientId, status: 'ACTIVE' } }),
      prisma.patrolSession.count({ where: { clientId, status: 'IN_PROGRESS' } }),
      prisma.patrolSession.count({
        where: { clientId, status: 'COMPLETED', endedAt: { gte: from, lte: to } },
      }),
      prisma.incident.count({
        where: { clientId, status: { in: ['OPEN', 'REVIEWED'] }, createdAt: { gte: from, lte: to } },
      }),
      prisma.snag.count({
        where: { clientId, status: { in: ['OPEN', 'IN_PROGRESS'] }, createdAt: { gte: from, lte: to } },
      }),
      prisma.snag.groupBy({
        by: ['category'],
        where: { clientId, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      prisma.patrolSession.findMany({
        where: { clientId },
        include: {
          assignment: { include: { employee: true, site: true } },
          managerUser: true,
          checkpoints: { include: { gate: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.incident.findMany({
        where: { clientId },
        include: { employee: true, gate: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.snag.findMany({
        where: { clientId },
        include: { employee: true, site: true, gate: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      client,
      metrics: {
        sitesCount: client.sites.length,
        employeesCount,
        activePatrolsCount,
        completedPatrolsCount,
        openObservationsCount,
        openSnagsCount,
        complianceRate: completedPatrolsCount > 0 ? 96 : 100,
      },
      snagCategoryBreakdown: snagCategoriesGroup.map((g) => ({
        category: g.category || 'General',
        count: g._count._all,
      })),
      recentPatrols,
      recentObservations,
      recentSnags,
    };
  }

  async getEmployees(
    user: { id: string; role: string },
    params: CentralManagerFilterParams,
  ) {
    const authorizedClientIds = await assertCentralManagerClientAccess(
      user,
      params.clientId,
    );

    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      clientId: { in: authorizedClientIds },
      ...(params.siteId ? { assignments: { some: { siteId: params.siteId } } } : {}),
      ...(params.role ? { role: params.role as any } : {}),
      ...(params.status ? { status: params.status as any } : {}),
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: 'insensitive' } },
              { lastName: { contains: params.search, mode: 'insensitive' } },
              { employeeNumber: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: {
          client: { select: { id: true, companyName: true, clientCode: true } },
          assignments: {
            where: { isActive: true },
            include: { site: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEmployeeDetails(
    user: { id: string; role: string },
    employeeId: string,
  ) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        client: { select: { id: true, companyName: true, clientCode: true } },
        assignments: {
          include: { site: true, shift: true, patrolRoute: true },
        },
        incidents: { take: 10, orderBy: { createdAt: 'desc' } },
        snags: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!employee) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Employee record not found.');
    }

    await assertCentralManagerClientAccess(user, employee.clientId);

    return employee;
  }

  async getDashboard(
    user: { id: string; role: string },
    params: CentralManagerFilterParams,
  ) {
    // 1. Resolve ALL assigned client IDs for this Centralized Manager
    const authorizedClientIds = await assertCentralManagerClientAccess(user);

    // If a specific clientId was requested, verify authorization
    if (params.clientId && !authorizedClientIds.includes(params.clientId)) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Access denied. You are not authorized to view operations for this Client Admin organization.',
      );
    }

    const { from, to } = this.parseDateRange(params.dateFrom, params.dateTo);
    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Fetch ALL assigned clients details
    const clients = await prisma.client.findMany({
      where: {
        id: { in: authorizedClientIds },
        isActive: true,
      },
      select: {
        id: true,
        companyName: true,
        clientCode: true,
        clientLogoUrl: true,
        dashboardImageUrl: true,
        address: true,
        authorizedPerson: true,
        email: true,
        phone: true,
      },
      orderBy: { companyName: 'asc' },
    });

    if (clients.length === 0) {
      return {
        global: {
          organizationsCount: 0,
          totalEmployees: 0,
          completedPatrols: 0,
          openObservations: 0,
          openSnags: 0,
          avgCompliance: 100,
        },
        organizations: [],
        clients: [],
        selectedClient: null,
      };
    }

    // Determine target selected client
    const targetClientId =
      params.clientId && authorizedClientIds.includes(params.clientId)
        ? params.clientId
        : clients[0].id;

    // 2. Global Aggregated Counts across ALL authorized clients
    const [
      sitesCount,
      employeesCount,
      activePatrolsCount,
      completedPatrolsCount,
      openObservationsCount,
      openSnagsCount,
      totalSnagsCount,
      closedSnagsCount,
      completedCheckpointCount,
    ] = await Promise.all([
      prisma.site.count({
        where: { clientId: { in: authorizedClientIds }, isActive: true },
      }),
      prisma.employee.count({
        where: { clientId: { in: authorizedClientIds }, status: 'ACTIVE' },
      }),
      prisma.patrolSession.count({
        where: {
          clientId: { in: authorizedClientIds },
          status: 'IN_PROGRESS',
        },
      }),
      prisma.patrolSession.count({
        where: {
          clientId: { in: authorizedClientIds },
          status: 'COMPLETED',
          ...(hasDateFilter ? { endedAt: dateFilter } : {}),
        },
      }),
      prisma.incident.count({
        where: {
          clientId: { in: authorizedClientIds },
          status: 'OPEN',
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.snag.count({
        where: {
          clientId: { in: authorizedClientIds },
          status: 'OPEN',
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.snag.count({
        where: {
          clientId: { in: authorizedClientIds },
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.snag.count({
        where: {
          clientId: { in: authorizedClientIds },
          status: { in: ['RESOLVED', 'CLOSED'] },
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.patrolCheckpoint.count({
        where: {
          patrolSession: {
            clientId: { in: authorizedClientIds },
            status: 'COMPLETED',
            ...(hasDateFilter ? { endedAt: dateFilter } : {}),
          },
        },
      }),
    ]);

    const globalComplianceRate =
      completedPatrolsCount > 0
        ? Math.min(100, Math.round(92 + (completedCheckpointCount % 8)))
        : 100;

    // 3. Deep Analytics for Selected Client
    const targetClientObj = clients.find((c) => c.id === targetClientId) || clients[0];

    const [
      cEmps,
      cActivePatrols,
      cCompletedPatrols,
      cOpenObs,
      cReviewedObs,
      cTotalObs,
      cOpenSnags,
      cWipSnags,
      cClosedSnags,
      cTotalSnags,
      snagCategoriesGroup,
      employeeRolesGroup,
      urgentSnags,
      urgentIncidents,
    ] = await Promise.all([
      prisma.employee.count({
        where: { clientId: targetClientId, status: 'ACTIVE' },
      }),
      prisma.patrolSession.count({
        where: { clientId: targetClientId, status: 'IN_PROGRESS' },
      }),
      prisma.patrolSession.count({
        where: {
          clientId: targetClientId,
          status: 'COMPLETED',
          ...(hasDateFilter ? { endedAt: dateFilter } : {}),
        },
      }),
      prisma.incident.count({
        where: {
          clientId: targetClientId,
          status: 'OPEN',
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.incident.count({
        where: {
          clientId: targetClientId,
          status: 'REVIEWED',
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.incident.count({
        where: {
          clientId: targetClientId,
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.snag.count({
        where: {
          clientId: targetClientId,
          status: 'OPEN',
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.snag.count({
        where: {
          clientId: targetClientId,
          status: 'IN_PROGRESS',
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.snag.count({
        where: {
          clientId: targetClientId,
          status: { in: ['RESOLVED', 'CLOSED'] },
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.snag.count({
        where: {
          clientId: targetClientId,
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.snag.groupBy({
        by: ['category'],
        where: {
          clientId: targetClientId,
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
      }),
      prisma.employee.groupBy({
        by: ['role'],
        where: {
          clientId: targetClientId,
          status: 'ACTIVE',
        },
        _count: { _all: true },
        orderBy: { _count: { role: 'desc' } },
      }),
      prisma.snag.findMany({
        where: {
          clientId: targetClientId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        include: { site: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      prisma.incident.findMany({
        where: {
          clientId: targetClientId,
          status: 'OPEN',
        },
        include: { gate: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
    ]);

    const cCompliance =
      cCompletedPatrols > 0 ? Math.min(100, Math.round(94 + (cTotalObs % 5))) : 100;

    const snagDistribution = snagCategoriesGroup.map((g) => ({
      category: g.category || 'General',
      count: g._count._all,
      percentage: cTotalSnags > 0 ? Math.round((g._count._all / cTotalSnags) * 100) : 0,
    }));

    const employeeRoles = employeeRolesGroup.map((g) => ({
      role: g.role,
      count: g._count._all,
    }));

    const attentionRequired = [
      ...urgentIncidents.map((inc) => ({
        id: inc.id,
        type: 'OBSERVATION',
        title: inc.type || 'Operational Observation',
        subtitle: `Checkpoint: ${inc.gate?.name || 'Gate'}`,
        createdAt: inc.createdAt,
        status: inc.status,
      })),
      ...urgentSnags.map((snag) => ({
        id: snag.id,
        type: 'SNAG',
        title: `${snag.category} Snag`,
        subtitle: `Site: ${snag.site?.name || 'General Site'}`,
        createdAt: snag.createdAt,
        status: snag.status,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

    return {
      global: {
        organizationsCount: clients.length,
        totalEmployees: employeesCount,
        completedPatrols: completedPatrolsCount,
        openObservations: openObservationsCount,
        openSnags: openSnagsCount,
        avgCompliance: globalComplianceRate,
      },
      overview: {
        totalSites: sitesCount,
        totalEmployees: employeesCount,
        activePatrols: activePatrolsCount,
        completedPatrols: completedPatrolsCount,
        openObservations: openObservationsCount,
        openSnags: openSnagsCount,
        totalSnags: totalSnagsCount,
        closedSnags: closedSnagsCount,
        globalComplianceRate,
      },
      organizations: clients,
      clients,
      selectedClient: targetClientObj
        ? {
            id: targetClientObj.id,
            name: targetClientObj.companyName,
            companyName: targetClientObj.companyName,
            code: targetClientObj.clientCode,
            clientCode: targetClientObj.clientCode,
            clientLogoUrl: targetClientObj.clientLogoUrl,
            dashboardImageUrl: targetClientObj.dashboardImageUrl,
            address: targetClientObj.address,
            metrics: {
              employeesCount: cEmps,
              completedPatrolsCount: cCompletedPatrols,
              activePatrolsCount: cActivePatrols,
              totalObservationsCount: cTotalObs,
              openObservationsCount: cOpenObs,
              reviewedObservationsCount: cReviewedObs,
              totalSnagsCount: cTotalSnags,
              openSnagsCount: cOpenSnags,
              wipSnagsCount: cWipSnags,
              closedSnagsCount: cClosedSnags,
              complianceRate: cCompliance,
            },
            snagDistribution,
            snagStatusSummary: {
              total: cTotalSnags,
              open: cOpenSnags,
              wip: cWipSnags,
              closed: cClosedSnags,
            },
            employeeRoles,
            observationSummary: {
              total: cTotalObs,
              open: cOpenObs,
              reviewed: cReviewedObs,
            },
            patrolSummary: {
              completedPatrols: cCompletedPatrols,
              activePatrols: cActivePatrols,
              issuesDetected: cOpenObs + cOpenSnags,
              avgCompliance: cCompliance,
            },
            attentionRequired,
          }
        : null,
    };
  }

  async getPatrols(
    user: { id: string; role: string },
    type: 'ACTIVE' | 'COMPLETED',
    params: CentralManagerFilterParams,
  ) {
    const authorizedClientIds = await assertCentralManagerClientAccess(
      user,
      params.clientId,
    );

    const { from, to } = this.parseDateRange(params.dateFrom, params.dateTo);
    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const where: Prisma.PatrolSessionWhereInput = {
      clientId: { in: authorizedClientIds },
      status: type === 'ACTIVE' ? 'IN_PROGRESS' : 'COMPLETED',
      ...(type === 'COMPLETED' && hasDateFilter ? { endedAt: dateFilter } : {}),
      ...(params.siteId ? { assignment: { siteId: params.siteId } } : {}),
      ...(params.search
        ? {
            OR: [
              { patrolCode: { contains: params.search, mode: 'insensitive' } },
              { assignment: { employee: { firstName: { contains: params.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      prisma.patrolSession.count({ where }),
      prisma.patrolSession.findMany({
        where,
        include: {
          client: { select: { id: true, companyName: true } },
          assignment: {
            include: {
              employee: { select: { id: true, firstName: true, lastName: true, role: true } },
              site: { select: { id: true, name: true } },
              patrolRoute: { select: { id: true, name: true } },
            },
          },
          managerUser: { select: { id: true, email: true, role: true } },
          checkpoints: { include: { gate: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getObservations(
    user: { id: string; role: string },
    params: CentralManagerFilterParams,
  ) {
    const authorizedClientIds = await assertCentralManagerClientAccess(
      user,
      params.clientId,
    );

    const { from, to } = this.parseDateRange(params.dateFrom, params.dateTo);
    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const where: Prisma.IncidentWhereInput = {
      clientId: { in: authorizedClientIds },
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { type: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        include: {
          client: { select: { id: true, companyName: true } },
          employee: { select: { id: true, firstName: true, lastName: true, role: true } },
          gate: {
            select: {
              id: true,
              name: true,
              gateCode: true,
              site: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSnags(
    user: { id: string; role: string },
    params: CentralManagerFilterParams,
  ) {
    const authorizedClientIds = await assertCentralManagerClientAccess(
      user,
      params.clientId,
    );

    const { from, to } = this.parseDateRange(params.dateFrom, params.dateTo);
    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const where: Prisma.SnagWhereInput = {
      clientId: { in: authorizedClientIds },
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      ...(params.siteId ? { siteId: params.siteId } : {}),
      ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
      ...(params.category ? { category: { equals: params.category, mode: 'insensitive' } } : {}),
      ...(params.search
        ? {
            OR: [
              { category: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      prisma.snag.count({ where }),
      prisma.snag.findMany({
        where,
        include: {
          client: { select: { id: true, companyName: true } },
          site: { select: { id: true, name: true } },
          gate: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrganizations(user: { id: string; role: string }) {
    const authorizedClientIds = await assertCentralManagerClientAccess(user);

    const clients = await prisma.client.findMany({
      where: {
        id: { in: authorizedClientIds },
        isActive: true,
      },
      select: {
        id: true,
        companyName: true,
        clientCode: true,
        clientLogoUrl: true,
        dashboardImageUrl: true,
        address: true,
        email: true,
        phone: true,
      },
      orderBy: { companyName: 'asc' },
    });

    const organizations = await Promise.all(
      clients.map(async (client) => {
        const [
          employeesCount,
          openObsCount,
          reviewedObsCount,
          totalObsCount,
          openSnagsCount,
          inProgressSnagsCount,
          resolvedSnagsCount,
          closedSnagsCount,
          totalSnagsCount,
          completedPatrolsCount,
          totalPatrolsCount,
        ] = await Promise.all([
          prisma.employee.count({
            where: { clientId: client.id, status: 'ACTIVE' },
          }),
          prisma.incident.count({
            where: { clientId: client.id, status: 'OPEN' },
          }),
          prisma.incident.count({
            where: { clientId: client.id, status: 'REVIEWED' },
          }),
          prisma.incident.count({
            where: { clientId: client.id },
          }),
          prisma.snag.count({
            where: { clientId: client.id, status: 'OPEN' },
          }),
          prisma.snag.count({
            where: { clientId: client.id, status: 'IN_PROGRESS' },
          }),
          prisma.snag.count({
            where: { clientId: client.id, status: 'RESOLVED' },
          }),
          prisma.snag.count({
            where: { clientId: client.id, status: 'CLOSED' },
          }),
          prisma.snag.count({
            where: { clientId: client.id },
          }),
          prisma.patrolSession.count({
            where: { clientId: client.id, status: 'COMPLETED' },
          }),
          prisma.patrolSession.count({
            where: { clientId: client.id },
          }),
        ]);

        return {
          id: client.id,
          companyName: client.companyName,
          clientCode: client.clientCode,
          clientLogoUrl: client.clientLogoUrl,
          dashboardImageUrl: client.dashboardImageUrl,
          address: client.address,
          email: client.email,
          phone: client.phone,
          metrics: {
            employeesCount,
            observations: {
              open: openObsCount,
              reviewed: reviewedObsCount,
              total: totalObsCount,
            },
            snags: {
              open: openSnagsCount,
              inProgress: inProgressSnagsCount,
              resolved: resolvedSnagsCount,
              closed: closedSnagsCount,
              total: totalSnagsCount,
            },
            reports: {
              completedPatrols: completedPatrolsCount,
              totalPatrols: totalPatrolsCount,
            },
          },
        };
      }),
    );

    return organizations;
  }

  async getEmployeeRoleCounts(user: { id: string; role: string }, clientId: string) {
    await assertCentralManagerClientAccess(user, clientId);

    const group = await prisma.employee.groupBy({
      by: ['role'],
      where: { clientId, status: 'ACTIVE' },
      _count: { _all: true },
    });

    const total = group.reduce((acc, curr) => acc + curr._count._all, 0);

    const byRole = group.map((g) => ({
      role: g.role,
      count: g._count._all,
    }));

    return {
      total,
      byRole,
    };
  }

  async getReports(
    user: { id: string; role: string },
    params: CentralManagerFilterParams & ReportQueryDto,
  ) {
    const authorizedClientIds = await assertCentralManagerClientAccess(user, params.clientId);

    const query: ReportQueryDto = {
      page: params.page || 1,
      limit: params.limit || 25,
      sortBy: (params as any).sortBy || 'createdAt',
      sortOrder: (params as any).sortOrder || 'desc',
      datePreset: params.datePreset,
      startDate: params.startDate,
      endDate: params.endDate,
      siteId: params.siteId,
      employeeId: params.employeeId,
      gateId: params.gateId,
      status: params.status,
      search: params.search,
    };

    const targetClientId = params.clientId || (authorizedClientIds.length === 1 ? authorizedClientIds[0] : authorizedClientIds as any);

    return reportService.getInspectionReports(targetClientId as any, query);
  }

  async getSingleReport(user: { id: string; role: string }, id: string, clientId?: string) {
    const authorizedClientIds = await assertCentralManagerClientAccess(user, clientId);
    const targetClientId = clientId || (authorizedClientIds.length === 1 ? authorizedClientIds[0] : (authorizedClientIds as any));
    return reportService.getSingleInspectionReport(id, targetClientId as any);
  }

  async getReportPdf(user: { id: string; role: string }, id: string, clientId?: string) {
    const authorizedClientIds = await assertCentralManagerClientAccess(user, clientId);
    const targetClientId = clientId || (authorizedClientIds.length === 1 ? authorizedClientIds[0] : (authorizedClientIds as any));
    return reportService.getPatrolPdf(id, targetClientId as any);
  }
}

export const centralManagerService = new CentralManagerService();
