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

  findFullById(id: string) {
    return prisma.patrolSession.findUnique({
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
