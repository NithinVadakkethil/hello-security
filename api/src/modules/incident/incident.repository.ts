import { prisma } from '../../database/prisma';

export class IncidentRepository {
  create(data: {
    clientId: string;
    employeeId: string;
    type: string;
    severity: string;
    description: string;
    images?: string[];
    patrolSessionId?: string | null;
    gateId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }) {
    return prisma.incident.create({
      data: {
        clientId: data.clientId,
        employeeId: data.employeeId,
        type: data.type,
        severity: data.severity,
        description: data.description,
        images: data.images || [],
        patrolSessionId: data.patrolSessionId,
        gateId: data.gateId,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }

  list(clientId: string) {
    return prisma.incident.findMany({
      where: {
        clientId,
      },
      include: {
        employee: true,
        gate: {
          include: {
            site: true,
          },
        },
        patrolSession: {
          include: {
            assignment: {
              include: {
                site: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findById(id: string) {
    return prisma.incident.findUnique({
      where: {
        id,
      },
      include: {
        employee: true,
        gate: {
          include: {
            site: true,
          },
        },
        patrolSession: {
          include: {
            assignment: {
              include: {
                site: true,
              },
            },
          },
        },
      },
    });
  }
}

export const incidentRepository = new IncidentRepository();
