import { PatrolStatus } from '@prisma/client';

import { prisma } from '../../database/prisma';
import { ListPatrolSessionsQuery } from './patrol-session.types';
import { isRoleMatching } from '../../common/utils/role-matching';

export class PatrolSessionRepository {
  create(data: any) {
    return prisma.patrolSession.create({
      data,
      include: {
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
                          orderBy: { displayOrder: "asc" },
                        },
                      },
                    },
                  },
                  orderBy: {
                    sequence: "asc",
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
                      orderBy: { displayOrder: "asc" },
                    },
                  },
                },
              },
              orderBy: {
                sequence: "asc",
              },
            },
          },
        },
      },
    });
  }

  findById(id: string) {
    return prisma.patrolSession.findUnique({
      where: { id },
      include: {
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
      },
    });
  }

  findActiveByAssignment(assignmentId: string) {
    return prisma.patrolSession.findFirst({
      where: {
        assignmentId,
        status: { in: [PatrolStatus.IN_PROGRESS, PatrolStatus.PAUSED] },
      },
    });
  }

  findActiveByEmployee(employeeId: string) {
    return prisma.patrolSession.findFirst({
      where: {
        status: { in: [PatrolStatus.IN_PROGRESS, PatrolStatus.PAUSED] },
        assignment: { employeeId },
      },
      include: {
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
      },
    });
  }

  findByPatrolCode(patrolCode: string) {
    return prisma.patrolSession.findFirst({
      where: {
        patrolCode,
      },
    });
  }

  async findFullById(id: string) {
    const session = await prisma.patrolSession.findUnique({
      where: {
        id,
      },
      include: {
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
    });

    if (!session) return null;

    const incidents = await prisma.incident.findMany({
      where: {
        patrolSessionId: id,
      },
    });

    const snags = await prisma.snag.findMany({
      where: {
        patrolSessionId: id,
      },
      include: {
        gate: { select: { id: true, name: true, gateCode: true } },
      },
    });

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
      incidents,
      snags,
    };
  }

  verifyPatrolSession(
    id: string,
    data: {
      verificationStatus: 'VERIFIED' | 'NOT_VERIFIED' | 'PENDING';
      verifiedById: string;
      verificationTime: Date;
      supervisorRemarks?: string;
    },
  ) {
    return prisma.patrolSession.update({
      where: { id },
      data,
    });
  }

  update(id: string, data: any) {
    return prisma.patrolSession.update({
      where: { id },
      data,
    });
  }

  async cancel(id: string) {
    const session = await prisma.patrolSession.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!session) {
      return { success: true, message: 'Patrol session already cleared or cancelled.' };
    }

    if (session.status === PatrolStatus.CANCELLED) {
      return { success: true, message: 'Patrol session is already cancelled.' };
    }

    return prisma.patrolSession.update({
      where: { id },
      data: {
        status: PatrolStatus.CANCELLED,
        endedAt: new Date(),
      },
    });
  }

  async list(clientId: string, query?: ListPatrolSessionsQuery) {
    const page = query?.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query?.limit && query.limit > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    const where: any = { clientId };

    if (query?.tab === 'live') {
      where.status = { in: [PatrolStatus.IN_PROGRESS, PatrolStatus.PAUSED] };
    } else if (query?.tab === 'history') {
      where.OR = [
        { status: PatrolStatus.COMPLETED },
        {
          status: PatrolStatus.CANCELLED,
          checkpoints: { some: {} },
        },
      ];
    } else if (query?.status) {
      where.status = query.status as PatrolStatus;
    }

    if (query?.siteId) {
      where.assignment = { ...where.assignment, siteId: query.siteId };
    }

    if (query?.employeeId) {
      where.assignment = { ...where.assignment, employeeId: query.employeeId };
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { patrolCode: { contains: s, mode: 'insensitive' } },
        {
          assignment: {
            employee: { firstName: { contains: s, mode: 'insensitive' } },
          },
        },
        {
          assignment: {
            employee: { lastName: { contains: s, mode: 'insensitive' } },
          },
        },
        {
          assignment: {
            site: { name: { contains: s, mode: 'insensitive' } },
          },
        },
      ];
    }

    const [total, sessions] = await Promise.all([
      prisma.patrolSession.count({ where }),
      prisma.patrolSession.findMany({
        where,
        skip,
        take: limit,
        include: {
          checkpoints: {
            select: {
              id: true,
              gateId: true,
              scannedAt: true,
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
          assignment: {
            include: {
              employee: true,
              site: true,
              shift: true,
              patrolRoute: {
                include: {
                  routeGates: {
                    select: {
                      id: true,
                      gateId: true,
                      sequence: true,
                    },
                  },
                },
              },
              assignmentGates: {
                include: {
                  gate: true,
                },
              },
            },
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
      }),
    ]);

    const enhancedSessions = sessions.map((session) => {
      const uniqueScannedGateIds = new Set(
        (session.checkpoints || []).map((cp) => cp.gateId).filter(Boolean),
      );
      const scannedCount = uniqueScannedGateIds.size;

      const totalCheckpointCount =
        session.assignment?.patrolRoute?.routeGates?.length ||
        session.assignment?.assignmentGates?.length ||
        0;

      return {
        ...session,
        scannedCount,
        totalCheckpointCount,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      sessions: enhancedSessions,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
}

export const patrolSessionRepository = new PatrolSessionRepository();
