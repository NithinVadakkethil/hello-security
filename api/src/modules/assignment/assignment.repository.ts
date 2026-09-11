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
            include: {
              gate: {
                include: {
                  subTasks: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                  },
                },
              },
            },
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
          include: {
            gate: {
              include: {
                subTasks: {
                  where: { isActive: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
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
            gate: {
              include: {
                subTasks: {
                  where: { isActive: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
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
                gate: {
                  include: {
                    subTasks: {
                      where: { isActive: true },
                      orderBy: { displayOrder: 'asc' },
                    },
                  },
                },
              },
              orderBy: {
                sequence: 'asc',
              },
            },
          },
        },
        assignmentGates: {
          include: {
            gate: {
              include: {
                subTasks: {
                  where: { isActive: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
          orderBy: {
            sequence: 'asc',
          },
        },
        patrolSessions: {
          where: {
            status: 'COMPLETED',
          },
          orderBy: {
            endedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findEmployeeActiveAssignmentForRoute(
    employeeId: string,
    siteId: string,
    shiftId: string,
    patrolRouteId: string,
  ) {
    return prisma.guardAssignment.findFirst({
      where: {
        employeeId,
        siteId,
        shiftId,
        patrolRouteId,
        isActive: true,
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
                gate: {
                  include: {
                    subTasks: {
                      where: { isActive: true },
                      orderBy: { displayOrder: 'asc' },
                    },
                  },
                },
              },
              orderBy: {
                sequence: 'asc',
              },
            },
          },
        },
        assignmentGates: {
          include: {
            gate: {
              include: {
                subTasks: {
                  where: { isActive: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
          orderBy: {
            sequence: 'asc',
          },
        },
        patrolSessions: {
          where: {
            status: 'COMPLETED',
          },
          orderBy: {
            endedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findEmployeeAllAssignments(employeeId: string) {
    return prisma.guardAssignment.findMany({
      where: {
        employeeId,
      },
      include: {
        employee: true,
        site: true,
        shift: true,
        patrolRoute: {
          include: {
            routeGates: {
              include: {
                gate: {
                  include: {
                    subTasks: {
                      where: { isActive: true },
                      orderBy: { displayOrder: 'asc' },
                    },
                  },
                },
              },
              orderBy: {
                sequence: 'asc',
              },
            },
          },
        },
        assignmentGates: {
          include: {
            gate: {
              include: {
                subTasks: {
                  where: { isActive: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
          orderBy: {
            sequence: 'asc',
          },
        },
        patrolSessions: {
          where: {
            status: 'COMPLETED',
          },
          orderBy: {
            endedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        effectiveFrom: 'desc',
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
