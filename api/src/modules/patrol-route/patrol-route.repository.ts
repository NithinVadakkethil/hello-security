import { prisma } from '../../database/prisma';
import { GATE_SUBTASKS_INCLUDE } from '../assignment/assignment.repository';

export class PatrolRouteRepository {
  create(data: any) {
    return prisma.patrolRoute.create({
      data,
      include: {
        routeGates: {
          include: {
            gate: {
              include: GATE_SUBTASKS_INCLUDE,
            },
          },
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  findById(id: string) {
    return prisma.patrolRoute.findUnique({
      where: {
        id,
      },
      include: {
        site: true,
        routeGates: {
          include: {
            gate: {
              include: GATE_SUBTASKS_INCLUDE,
            },
          },
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  findByName(siteId: string, name: string) {
    return prisma.patrolRoute.findFirst({
      where: {
        siteId,
        name,
      },
    });
  }

  findGate(routeId: string, gateId: string) {
    return prisma.patrolRouteGate.findFirst({
      where: {
        patrolRouteId: routeId,
        gateId,
      },
    });
  }

  list(clientId: string, isActive?: boolean) {
    return prisma.patrolRoute.findMany({
      where: {
        clientId,
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        site: true,
        routeGates: {
          include: {
            gate: {
              include: GATE_SUBTASKS_INCLUDE,
            },
          },
          orderBy: {
            sequence: 'asc',
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  update(id: string, data: any) {
    return prisma.patrolRoute.update({
      where: {
        id,
      },
      data,
    });
  }

  activate(id: string) {
    return prisma.patrolRoute.update({
      where: {
        id,
      },
      data: {
        isActive: true,
      },
    });
  }

  deactivate(id: string) {
    return prisma.patrolRoute.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}

export const patrolRouteRepository = new PatrolRouteRepository();
