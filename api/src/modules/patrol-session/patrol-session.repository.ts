import { PatrolStatus } from '@prisma/client';

import { prisma } from '../../database/prisma';

export class PatrolSessionRepository {
  create(data: any) {
    return prisma.patrolSession.create({
      data,
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
                    gate: true,
                  },
                  orderBy: {
                    sequence: 'asc',
                  },
                },
              },
            },
            assignmentGates: {
              include: {
                gate: true,
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
        assignment: {
          employeeId,
        },
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
                    gate: true,
                  },
                  orderBy: {
                    sequence: 'asc',
                  },
                },
              },
            },
            assignmentGates: {
              include: {
                gate: true,
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
                    gate: true,
                  },
                  orderBy: {
                    sequence: 'asc',
                  },
                },
              },
            },
            assignmentGates: {
              include: {
                gate: true,
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
            gate: true,
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

    return {
      ...session,
      incidents,
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

  list(clientId: string) {
    return prisma.patrolSession.findMany({
      where: {
        clientId,
      },
      include: {
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
              select: {
                id: true,
                name: true,
                routeCode: true,
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
    });
  }
}

export const patrolSessionRepository = new PatrolSessionRepository();
