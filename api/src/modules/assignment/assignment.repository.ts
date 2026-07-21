import { prisma } from '../../database/prisma';

export class AssignmentRepository {
  create(data: any) {
    const { gateIds, ...rest } = data;
    if (gateIds && gateIds.length > 0) {
      return prisma.guardAssignment.create({
        data: {
          ...rest,
          assignmentGates: {
            create: gateIds.map((gateId: string, idx: number) => ({
              gateId,
              sequence: idx + 1,
            })),
          },
        },
        include: {
          employee: true,
          site: true,
          shift: true,
          patrolRoute: true,
          assignmentGates: {
            include: { gate: true },
          },
        },
      });
    }

    return prisma.guardAssignment.create({
      data: rest,
      include: {
        employee: true,
        site: true,
        shift: true,
        patrolRoute: true,
        assignmentGates: {
          include: { gate: true },
        },
      },
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
        assignmentGates: {
          include: {
            gate: true,
          },
        },
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
        assignmentGates: {
          include: {
            gate: true,
          },
          orderBy: {
            sequence: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findEmployeeActiveAssignments(employeeId: string) {
    return prisma.guardAssignment.findMany({
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
        assignmentGates: {
          include: {
            gate: true,
          },
          orderBy: {
            sequence: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
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
        assignmentGates: {
          include: {
            gate: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

export const assignmentRepository = new AssignmentRepository();
