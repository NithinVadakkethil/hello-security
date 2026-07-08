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
            patrolRoute: true,
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
            patrolRoute: true,
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
