import { prisma } from '../../database/prisma';

export class PatrolCheckpointRepository {
  create(data: any) {
    return prisma.patrolCheckpoint.create({
      data,
      include: {
        gate: true,
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
      },
    });
  }

  findBySessionAndGate(patrolSessionId: string, gateId: string) {
    return prisma.patrolCheckpoint.findFirst({
      where: {
        patrolSessionId,
        gateId,
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
}

export const patrolCheckpointRepository = new PatrolCheckpointRepository();
