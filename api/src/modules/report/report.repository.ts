import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AnalyticsResult, ReportQueryDto } from './report.types';
import { isRoleMatching } from '../../common/utils/role-matching';

export class ReportRepository {
  private buildWhereClause(clientId: string | undefined, query: ReportQueryDto): Prisma.PatrolSessionWhereInput {
    const where: Prisma.PatrolSessionWhereInput = {};

    if (clientId) {
      where.clientId = clientId;
    }

    // Status filter
    if (query.status && query.status !== 'ALL') {
      where.status = query.status as any;
    }

    // Date Filtering
    const now = new Date();
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (query.startDate) {
      fromDate = new Date(query.startDate);
    }
    if (query.endDate) {
      toDate = new Date(query.endDate);
      toDate.setHours(23, 59, 59, 999);
    }

    if (!fromDate && query.datePreset) {
      switch (query.datePreset) {
        case 'TODAY':
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'YESTERDAY':
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
          break;
        case 'LAST_7_DAYS':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'LAST_30_DAYS':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'THIS_MONTH':
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'PREVIOUS_MONTH':
          fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
      }
    }

    if (fromDate || toDate) {
      where.startedAt = {};
      if (fromDate) where.startedAt.gte = fromDate;
      if (toDate) where.startedAt.lte = toDate;
    }

    // Assignment Level Filters (employee, site, gate)
    const assignmentWhere: Prisma.GuardAssignmentWhereInput = {};

    if (query.employeeId) {
      assignmentWhere.employeeId = query.employeeId;
    }

    if (query.siteId) {
      assignmentWhere.siteId = query.siteId;
    }

    if (Object.keys(assignmentWhere).length > 0) {
      where.assignment = assignmentWhere;
    }

    // Checkpoint gate filter
    if (query.gateId) {
      where.checkpoints = {
        some: {
          gateId: query.gateId,
        },
      };
    }

    // Global Search across Guard Name, Code, Site Name, Route Name, Remarks
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { patrolCode: { contains: s, mode: 'insensitive' } },
        { remarks: { contains: s, mode: 'insensitive' } },
        {
          assignment: {
            employee: {
              OR: [
                { firstName: { contains: s, mode: 'insensitive' } },
                { lastName: { contains: s, mode: 'insensitive' } },
                { employeeNumber: { contains: s, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          assignment: {
            site: {
              name: { contains: s, mode: 'insensitive' },
            },
          },
        },
        {
          assignment: {
            patrolRoute: {
              name: { contains: s, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    return where;
  }

  async getAnalytics(clientId: string | undefined, query: ReportQueryDto): Promise<AnalyticsResult> {
    const where = this.buildWhereClause(clientId, query);

    const [
      totalInspections,
      completedInspections,
      failedInspections,
      pendingInspections,
      sessions,
      totalGuardsCount,
      totalSitesCount,
      totalCheckpointsCount,
      totalIncidentsCount,
    ] = await Promise.all([
      prisma.patrolSession.count({ where }),
      prisma.patrolSession.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.patrolSession.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.patrolSession.count({ where: { ...where, status: { in: ['IN_PROGRESS', 'PAUSED'] } } }),
      prisma.patrolSession.findMany({
        where,
        select: {
          id: true,
          totalDuration: true,
          status: true,
          checkpoints: { select: { id: true } },
          assignment: {
            select: {
              employeeId: true,
              siteId: true,
              patrolRoute: { select: { _count: { select: { routeGates: true } } } },
              assignmentGates: { select: { id: true } },
            },
          },
        },
      }),
      prisma.employee.count({ where: clientId ? { clientId } : {} }),
      prisma.site.count({ where: clientId ? { clientId } : {} }),
      prisma.gate.count({ where: clientId ? { site: { clientId } } : {} }),
      prisma.incident.count({ where: clientId ? { clientId } : {} }),
    ]);

    // Calculate Average Duration
    const completedSessions = sessions.filter((s) => s.status === 'COMPLETED' && s.totalDuration);
    const totalDurationSec = completedSessions.reduce((acc, curr) => acc + (curr.totalDuration || 0), 0);
    const averageDurationMins = completedSessions.length ? Math.round(totalDurationSec / completedSessions.length / 60) : 0;

    // Calculate Compliance Rate
    const complianceRate = totalInspections ? Math.round((completedInspections / totalInspections) * 100) : 0;

    return {
      totalInspections,
      completedInspections,
      failedInspections,
      pendingInspections,
      totalGuards: totalGuardsCount,
      totalSites: totalSitesCount,
      totalCheckpoints: totalCheckpointsCount,
      complianceRate,
      averageDurationMins,
      totalIssuesReported: totalIncidentsCount,
    };
  }

  async findInspectionReports(clientId: string | undefined, query: ReportQueryDto) {
    const where = this.buildWhereClause(clientId, query);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      prisma.patrolSession.count({ where }),
      prisma.patrolSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'startedAt']: query.sortOrder || 'desc',
        },
        include: {
          client: true,
          assignment: {
            include: {
              employee: true,
              site: true,
              shift: true,
              patrolRoute: {
                include: {
                  routeGates: {
                    include: {
                      gate: {
                        include: {
                          subTasks: {
                            where: { isActive: true },
                            orderBy: { displayOrder: 'asc' },
                          },
                        },
                      },
                    },
                    orderBy: {
                      sequence: 'asc',
                    },
                  },
                },
              },
              assignmentGates: {
                include: {
                  gate: {
                    include: {
                      subTasks: {
                        where: { isActive: true },
                        orderBy: { displayOrder: 'asc' },
                      },
                    },
                  },
                },
                orderBy: {
                  sequence: 'asc',
                },
              },
            },
          },
          checkpoints: {
            include: {
              gate: {
                include: {
                  subTasks: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                  },
                },
              },
              subTaskResponses: {
                include: {
                  gateSubTask: true,
                },
              },
            },
            orderBy: {
              scannedAt: 'asc',
            },
          },
        },
      }),
    ]);

    // Fetch incidents and snags for each session
    const sessionIds = data.map((d) => d.id);
    const [incidents, snags] = await Promise.all([
      prisma.incident.findMany({
        where: {
          patrolSessionId: { in: sessionIds },
        },
      }),
      prisma.snag.findMany({
        where: {
          patrolSessionId: { in: sessionIds },
        },
        include: {
          gate: { select: { id: true, name: true, gateCode: true } },
        },
      }),
    ]);

    const enrichedData = data.map((session) => {
      const sessionIncidents = incidents.filter((i) => i.patrolSessionId === session.id);
      const sessionSnags = snags.filter((s) => s.patrolSessionId === session.id);
      const officerRole = session.assignment?.employee?.role || 'SECURITY';

      const filterSubTasks = (subTasks: any[]) => {
        if (!Array.isArray(subTasks)) return [];
        return subTasks.filter((st) => isRoleMatching(st.role, officerRole));
      };

      const filteredCheckpoints = (session.checkpoints || []).map((cp) => ({
        ...cp,
        gate: cp.gate
          ? {
              ...cp.gate,
              subTasks: filterSubTasks(cp.gate.subTasks),
            }
          : cp.gate,
        subTaskResponses: (cp.subTaskResponses || []).filter((res) =>
          isRoleMatching(res.gateSubTask?.role || (res as any).role, officerRole),
        ),
      }));

      const filteredAssignment = session.assignment
        ? {
            ...session.assignment,
            patrolRoute: session.assignment.patrolRoute
              ? {
                  ...session.assignment.patrolRoute,
                  routeGates: (session.assignment.patrolRoute.routeGates || []).map((rg) => ({
                    ...rg,
                    gate: rg.gate
                      ? {
                          ...rg.gate,
                          subTasks: filterSubTasks(rg.gate.subTasks),
                        }
                      : rg.gate,
                  })),
                }
              : session.assignment.patrolRoute,
            assignmentGates: (session.assignment.assignmentGates || []).map((ag) => ({
              ...ag,
              gate: ag.gate
                ? {
                    ...ag.gate,
                    subTasks: filterSubTasks(ag.gate.subTasks),
                  }
                : ag.gate,
            })),
          }
        : session.assignment;

      return {
        ...session,
        assignment: filteredAssignment,
        checkpoints: filteredCheckpoints,
        incidents: sessionIncidents,
        snags: sessionSnags,
      };
    });

    return {
      data: enrichedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}

export const reportRepository = new ReportRepository();
