import { prisma } from '../../database/prisma';
import { getRolePriority } from '../../common/utils/role-order.util';

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

  async listEmployeeSummaries(
    clientId: string,
    params: {
      page: number;
      limit: number;
      search?: string;
      status?: string;
      role?: string;
    },
  ) {
    const { page, limit, search, status, role } = params;
    const skip = (page - 1) * limit;

    const employeeWhere: any = {
      clientId,
    };

    if (status === 'ACTIVE') {
      employeeWhere.assignments = {
        some: {
          clientId,
          isActive: true,
        },
      };
    } else if (status === 'INACTIVE') {
      employeeWhere.assignments = {
        some: {
          clientId,
          isActive: false,
        },
        none: {
          clientId,
          isActive: true,
        },
      };
    } else {
      employeeWhere.assignments = {
        some: {
          clientId,
        },
      };
    }

    if (!employeeWhere.AND) {
      employeeWhere.AND = [];
    }

    if (role && role !== 'ALL') {
      let targetRole = role.toUpperCase();
      if (targetRole === 'SECURITY_GUARD') targetRole = 'SECURITY';
      if (targetRole === 'LIFEGUARD') targetRole = 'LIFE_GUARD';

      employeeWhere.AND.push({
        OR: [
          { role: targetRole as any },
          { user: { role: targetRole as any } },
          { designation: { equals: targetRole, mode: 'insensitive' } },
        ],
      });
    }

    if (search && search.trim() !== '') {
      const s = search.trim();
      employeeWhere.AND.push({
        OR: [
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
          { employeeNumber: { contains: s, mode: 'insensitive' } },
          {
            assignments: {
              some: {
                clientId,
                site: { name: { contains: s, mode: 'insensitive' } },
              },
            },
          },
          {
            assignments: {
              some: {
                clientId,
                shift: { name: { contains: s, mode: 'insensitive' } },
              },
            },
          },
          {
            assignments: {
              some: {
                clientId,
                patrolRoute: { name: { contains: s, mode: 'insensitive' } },
              },
            },
          },
        ],
      });
    }

    if (employeeWhere.AND && employeeWhere.AND.length === 0) {
      delete employeeWhere.AND;
    }

    // Step 1: Query all matching employees with active assignments count for global sorting
    const matchingEmployees = await prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        user: {
          select: {
            role: true,
          },
        },
        assignments: {
          where: {
            clientId,
            isActive: true,
          },
          select: {
            id: true,
          },
        },
      },
    });

    // Step 2: Perform global active-first position, then role-priority and name sorting before pagination
    matchingEmployees.sort((a, b) => {
      const aActive = a.assignments.length > 0 ? 1 : 0;
      const bActive = b.assignments.length > 0 ? 1 : 0;
      if (aActive !== bActive) {
        return bActive - aActive; // Active employees (1) come before inactive (0)
      }

      const roleA = a.role || a.user?.role;
      const roleB = b.role || b.user?.role;
      const pA = getRolePriority(roleA);
      const pB = getRolePriority(roleB);

      if (pA !== pB) {
        return pA - pB;
      }

      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const totalEmployees = matchingEmployees.length;
    const pageEmployees = matchingEmployees.slice(skip, skip + limit);
    const pageEmployeeIds = pageEmployees.map((e) => e.id);

    // Step 3: Fetch full details for current page employees
    const fullEmployees = await prisma.employee.findMany({
      where: {
        id: { in: pageEmployeeIds },
      },
      include: {
        user: {
          select: {
            role: true,
          },
        },
        assignments: {
          where: {
            clientId,
          },
          include: {
            site: {
              select: {
                id: true,
                name: true,
              },
            },
            shift: {
              select: {
                id: true,
                name: true,
                startTime: true,
                endTime: true,
              },
            },
            patrolRoute: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    const employeeMap = new Map(fullEmployees.map((e) => [e.id, e]));
    const employees = pageEmployeeIds
      .map((id) => employeeMap.get(id))
      .filter(Boolean) as typeof fullEmployees;

    const data = employees.map((emp) => {
      const assignments = emp.assignments || [];
      const totalAssignments = assignments.length;
      const activeAssignments = assignments.filter((a) => a.isActive).length;
      const inactiveAssignments = assignments.filter((a) => !a.isActive).length;

      const siteMap = new Map<string, { id: string; name: string }>();
      assignments.forEach((a) => {
        if (a.site && !siteMap.has(a.site.id)) {
          siteMap.set(a.site.id, { id: a.site.id, name: a.site.name });
        }
      });

      const shiftMap = new Map<
        string,
        { id: string; name: string; startTime: string; endTime: string }
      >();
      assignments.forEach((a) => {
        if (a.shift && !shiftMap.has(a.shift.id)) {
          shiftMap.set(a.shift.id, {
            id: a.shift.id,
            name: a.shift.name,
            startTime: a.shift.startTime,
            endTime: a.shift.endTime,
          });
        }
      });

      return {
        id: emp.id,
        employeeId: emp.id,
        employeeCode: emp.employeeNumber,
        employeeName: `${emp.firstName} ${emp.lastName || ''}`.trim(),
        designation: emp.designation,
        role: emp.user?.role || emp.role || 'SECURITY',
        employeeStatus: emp.status,
        totalAssignments,
        activeAssignments,
        inactiveAssignments,
        status: activeAssignments > 0 ? 'ACTIVE' : 'INACTIVE',
        sites: Array.from(siteMap.values()),
        shifts: Array.from(shiftMap.values()),
      };
    });

    const totalPages = Math.ceil(totalEmployees / limit) || 1;

    return {
      data,
      pagination: {
        page,
        limit,
        totalEmployees,
        totalPages,
      },
    };
  }

  deactivateEmployeeAssignments(clientId: string, employeeId: string) {
    return prisma.guardAssignment.updateMany({
      where: {
        employeeId,
        clientId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  }

  activateEmployeeAssignments(clientId: string, assignmentIds: string[]) {
    return prisma.guardAssignment.updateMany({
      where: {
        id: { in: assignmentIds },
        clientId,
      },
      data: {
        isActive: true,
      },
    });
  }

  async getEmployeeWithAssignments(clientId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        clientId,
      },
      include: {
        user: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!employee) {
      return null;
    }

    const assignments = await prisma.guardAssignment.findMany({
      where: {
        clientId,
        employeeId,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                role: true,
              },
            },
          },
        },
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

    return {
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeNumber: employee.employeeNumber,
        designation: employee.designation,
        role: employee.user?.role || employee.role || 'SECURITY',
        status: employee.status,
      },
      assignments,
    };
  }
}

export const assignmentRepository = new AssignmentRepository();

