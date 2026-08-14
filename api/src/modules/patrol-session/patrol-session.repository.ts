import { PatrolStatus } from '@prisma/client';

import { prisma } from '../../database/prisma';
import { ListPatrolSessionsQuery } from './patrol-session.types';

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
        status: PatrolStatus.IN_PROGRESS,
      },
    });
  }

  findActiveByEmployee(employeeId: string) {
    return prisma.patrolSession.findFirst({
      where: {
        status: PatrolStatus.IN_PROGRESS,
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

    return {
      ...session,
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

    if (!session) return null;

    const checkpointCount = await prisma.patrolCheckpoint.count({
      where: { patrolSessionId: id },
    });

    if (checkpointCount === 0) {
      await prisma.patrolSession.delete({
        where: { id },
      });
      return { success: true, message: 'Unscanned patrol session deleted.' };
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
      where.status = {
        in: [PatrolStatus.COMPLETED, PatrolStatus.CANCELLED, PatrolStatus.NOT_STARTED],
      };
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
