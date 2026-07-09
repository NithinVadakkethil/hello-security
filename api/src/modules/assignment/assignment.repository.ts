import { prisma } from '../../database/prisma';

export class AssignmentRepository {
  create(data: any) {
    return prisma.guardAssignment.create({
      data,
    });
  }

  findById(id: string) {
    return prisma.guardAssignment.findUnique({
      where: {
        id,
      },
      include: {
        employee: true,
        site: true,
        shift: true,
        patrolRoute: true,
      },
    });
  }

  findEmployeeActiveAssignment(employeeId: string) {
    return prisma.guardAssignment.findFirst({
      where: {
        employeeId,
        isActive: true,
      },
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
    });
  }

  update(id: string, data: any) {
    return prisma.guardAssignment.update({
      where: {
        id,
      },
      data,
    });
  }

  activate(id: string) {
    return prisma.guardAssignment.update({
      where: {
        id,
      },
      data: {
        isActive: true,
      },
    });
  }

  deactivate(id: string) {
    return prisma.guardAssignment.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }

  list(clientId: string, isActive?: boolean) {
    return prisma.guardAssignment.findMany({
      where: {
        clientId,
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        employee: true,
        site: true,
        shift: true,
        patrolRoute: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

export const assignmentRepository = new AssignmentRepository();
