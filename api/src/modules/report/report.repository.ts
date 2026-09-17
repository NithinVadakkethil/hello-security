import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AnalyticsResult, ReportQueryDto } from './report.types';
import { isRoleMatching } from '../../common/utils/role-matching';

export class ReportRepository {
  private buildWhereClause(clientId: string | string[] | undefined, query: ReportQueryDto): Prisma.PatrolSessionWhereInput {
    const where: Prisma.PatrolSessionWhereInput = {};

    if (clientId) {
      if (Array.isArray(clientId)) {
        where.clientId = { in: clientId };
      } else {
        where.clientId = clientId;
      }
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

    const clientFilter = clientId
      ? Array.isArray(clientId)
        ? { clientId: { in: clientId } }
        : { clientId }
      : {};

    const [
      totalInspections,
      completedInspections,
      failedInspections,
      pendingInspections,
      sessions,
      totalGuardsCount,
      totalSitesCount,
      totalCheckpointsCount,
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
          checkpoints: { select: { id: true, gateId: true } },
          assignment: {
            select: {
              employeeId: true,
              siteId: true,
              assignmentType: true,
              patrolRoute: {
                select: {
                  routeGates: { select: { gateId: true } },
                },
              },
              assignmentGates: { select: { gateId: true } },
            },
          },
          incidents: { select: { id: true } },
          snags: { select: { id: true } },
        },
      }),
      prisma.employee.count({
        where: {
          status: 'ACTIVE',
          role: 'SECURITY',
          ...clientFilter,
          ...(query.siteId ? { assignments: { some: { siteId: query.siteId, isActive: true } } } : {}),
          ...(query.employeeId ? { id: query.employeeId } : {}),
        },
      }),
      prisma.site.count({
        where: {
          isActive: true,
          ...clientFilter,
          ...(query.siteId ? { id: query.siteId } : {}),
        },
      }),
      prisma.gate.count({
        where: {
          isActive: true,
          ...(clientId ? { site: clientFilter } : {}),
          ...(query.siteId ? { siteId: query.siteId } : {}),
          ...(query.gateId ? { id: query.gateId } : {}),
        },
      }),
    ]);

    // Calculate Average Duration for Completed Sessions
    const completedSessions = sessions.filter((s) => s.status === 'COMPLETED' && s.totalDuration && s.totalDuration > 0);
    const totalDurationSec = completedSessions.reduce((acc, curr) => acc + (curr.totalDuration || 0), 0);
    const averageDurationMins = completedSessions.length ? Math.round(totalDurationSec / completedSessions.length / 60) : 0;

    // Total Issues Reported (Incidents + Snags in filtered sessions)
    let totalIssuesReported = 0;
    for (const s of sessions) {
      totalIssuesReported += (s.incidents?.length || 0) + (s.snags?.length || 0);
    }

    // Calculate Overall Weighted Compliance Rate
    let totalExpectedSum = 0;
    let totalCompletedSum = 0;

    for (const s of sessions) {
      const isDirect =
        (s.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
        (!s.assignment?.patrolRoute && (s.assignment?.assignmentGates?.length || 0) > 0);

      const expectedGateIds: string[] = isDirect
        ? (s.assignment?.assignmentGates || []).map((ag) => ag.gateId).filter(Boolean)
        : (s.assignment?.patrolRoute?.routeGates || []).map((rg) => rg.gateId).filter(Boolean);

      const expectedGatesSet = new Set(expectedGateIds);
      const expectedCount = expectedGatesSet.size;

      const scannedGateIds = (s.checkpoints || []).map((cp) => cp.gateId).filter(Boolean);
      const completedCount = new Set(scannedGateIds.filter((id) => expectedGatesSet.has(id))).size;

      if (expectedCount > 0) {
        totalExpectedSum += expectedCount;
        totalCompletedSum += completedCount;
      }
    }

    const complianceRate = totalExpectedSum > 0
      ? Math.round((totalCompletedSum / totalExpectedSum) * 100)
      : 100;

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
      totalIssuesReported,
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
          managerUser: {
            select: {
              id: true,
              email: true,
              role: true,
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeNumber: true,
                  role: true,
                },
              },
            },
          },
          checkpoints: {
            include: {
              gate: {
                include: {
                  site: {
                    select: {
                      id: true,
                      name: true,
                      clientId: true,
                    },
                  },
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
          site: { select: { id: true, name: true } },
          gate: { select: { id: true, name: true, gateCode: true } },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              role: true,
            },
          },
          assignments: {
            orderBy: { createdAt: 'desc' },
            include: {
              assignedTo: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                  employee: {
                    select: {
                      firstName: true,
                      lastName: true,
                      employeeNumber: true,
                      role: true,
                    },
                  },
                },
              },
              assignedBy: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                  employee: {
                    select: {
                      firstName: true,
                      lastName: true,
                      employeeNumber: true,
                    },
                  },
                },
              },
            },
          },
          history: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                  employee: {
                    select: {
                      firstName: true,
                      lastName: true,
                      employeeNumber: true,
                    },
                  },
                },
              },
            },
          },
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

  async findSingleInspectionReport(id: string, clientId?: string | string[]) {
    const session = await prisma.patrolSession.findFirst({
      where: {
        OR: [{ id }, { patrolCode: id }],
        ...(clientId ? { clientId: Array.isArray(clientId) ? { in: clientId } : clientId } : {}),
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
          managerUser: {
            select: {
              id: true,
              email: true,
              role: true,
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeNumber: true,
                  role: true,
                },
              },
            },
          },
          checkpoints: {
            include: {
              gate: {
                include: {
                  site: {
                    select: {
                      id: true,
                      name: true,
                      clientId: true,
                    },
                  },
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
        verifiedBy: {
          select: {
            id: true,
            email: true,
            role: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                designation: true,
              },
            },
          },
        },
        incidents: true,
        snags: {
          include: {
            site: { select: { id: true, name: true } },
            gate: { select: { id: true, name: true, gateCode: true } },
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                role: true,
              },
            },
            assignments: {
              orderBy: { createdAt: 'desc' },
              include: {
                assignedTo: {
                  select: {
                    id: true,
                    email: true,
                    role: true,
                    employee: {
                      select: {
                        firstName: true,
                        lastName: true,
                        employeeNumber: true,
                        role: true,
                      },
                    },
                  },
                },
                assignedBy: {
                  select: {
                    id: true,
                    email: true,
                    role: true,
                    employee: {
                      select: {
                        firstName: true,
                        lastName: true,
                        employeeNumber: true,
                      },
                    },
                  },
                },
              },
            },
            history: {
              orderBy: { createdAt: 'desc' },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    role: true,
                    employee: {
                      select: {
                        firstName: true,
                        lastName: true,
                        employeeNumber: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) return null;

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
    };
  }
}

export const reportRepository = new ReportRepository();
