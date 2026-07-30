import { prisma } from '../../database/prisma';

export class PatrolCheckpointRepository {
  create(data: any) {
    return prisma.patrolCheckpoint.create({
      data,
      include: {
        gate: true,
        subTaskResponses: {
          include: {
            gateSubTask: true,
          },
        },
      },
    });
  }

  findById(id: string) {
    return prisma.patrolCheckpoint.findUnique({
      where: {
        id,
      },
      include: {
        gate: true,
        patrolSession: true,
        subTaskResponses: {
          include: {
            gateSubTask: true,
          },
        },
      },
    });
  }

  findBySessionAndGate(patrolSessionId: string, gateId: string) {
    return prisma.patrolCheckpoint.findFirst({
      where: {
        patrolSessionId,
        gateId,
      },
      include: {
        subTaskResponses: {
          include: {
            gateSubTask: true,
          },
        },
      },
    });
  }

  countBySession(patrolSessionId: string) {
    return prisma.patrolCheckpoint.count({
      where: {
        patrolSessionId,
      },
    });
  }

  listBySession(patrolSessionId: string) {
    return prisma.patrolCheckpoint.findMany({
      where: {
        patrolSessionId,
      },
      include: {
        gate: true,
        subTaskResponses: {
          include: {
            gateSubTask: true,
          },
        },
      },
      orderBy: {
        scannedAt: 'asc',
      },
    });
  }

  delete(id: string) {
    return prisma.patrolCheckpoint.delete({
      where: {
        id,
      },
    });
  }

  update(id: string, data: any) {
    return prisma.patrolCheckpoint.update({
      where: {
        id,
      },
      data,
      include: {
        gate: true,
        subTaskResponses: {
          include: {
            gateSubTask: true,
          },
        },
      },
    });
  }
}

export const patrolCheckpointRepository = new PatrolCheckpointRepository();
