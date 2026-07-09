import { prisma } from '../../database/prisma';

export class PatrolRouteGateRepository {
  create(data: any) {
    return prisma.patrolRouteGate.create({
      data,
      include: {
        gate: true,
      },
    });
  }

  findById(id: string) {
    return prisma.patrolRouteGate.findUnique({
      where: { id },
      include: {
        gate: true,
        patrolRoute: true,
      },
    });
  }

  list(routeId: string) {
    return prisma.patrolRouteGate.findMany({
      where: {
        patrolRouteId: routeId,
      },
      include: {
        gate: true,
      },
      orderBy: {
        sequence: 'asc',
      },
    });
  }

  findByGate(routeId: string, gateId: string) {
    return prisma.patrolRouteGate.findFirst({
      where: {
        patrolRouteId: routeId,
        gateId,
      },
    });
  }

  findByRouteAndGate(routeId: string, gateId: string) {
    return prisma.patrolRouteGate.findFirst({
      where: {
        patrolRouteId: routeId,
        gateId,
      },
      include: {
        gate: true,
      },
    });
  }

  findBySequence(routeId: string, sequence: number) {
    return prisma.patrolRouteGate.findFirst({
      where: {
        patrolRouteId: routeId,
        sequence,
      },
    });
  }

  update(id: string, data: any) {
    return prisma.patrolRouteGate.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return prisma.patrolRouteGate.delete({
      where: { id },
    });
  }
}

export const patrolRouteGateRepository = new PatrolRouteGateRepository();
