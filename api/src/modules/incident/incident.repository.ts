import { prisma } from '../../database/prisma';

export class IncidentRepository {
  create(data: {
    clientId: string;
    employeeId: string;
    type: string;
    severity: string;
    description: string;
    images?: string[];
  }) {
    return prisma.incident.create({
      data: {
        clientId: data.clientId,
        employeeId: data.employeeId,
        type: data.type,
        severity: data.severity,
        description: data.description,
        images: data.images || [],
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
      },
    });
  }
}

export const incidentRepository = new IncidentRepository();
