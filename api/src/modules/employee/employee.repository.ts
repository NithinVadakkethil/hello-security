import { EmployeeStatus, Prisma } from '@prisma/client';
import { SupervisorScope } from '../../common/auth/supervisor-scope';
import { compareEmployeesByRoleOrder } from '../../common/utils/role-order.util';

import { prisma } from '../../database/prisma';

export class EmployeeRepository {
  create(data: Prisma.EmployeeCreateInput) {
    return prisma.employee.create({
      data,
      include: {
        user: true,
      },
    });
  }

  findById(id: string) {
    return prisma.employee.findUnique({
      where: {
        id,
      },
      include: {
        user: true,
      },
    });
  }

  findByEmail(email: string) {
    return prisma.employee.findFirst({
      where: {
        email,
      },
    });
  }

  update(id: string, data: Prisma.EmployeeUpdateInput) {
    return prisma.employee.update({
      where: {
        id,
      },
      data,
      include: {
        user: true,
      },
    });
  }

  deactivate(id: string) {
    return prisma.employee.update({
      where: {
        id,
      },
      data: {
        status: 'INACTIVE',
      },
    });
  }

  activate(id: string) {
    return prisma.employee.update({
      where: {
        id,
      },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  async list(clientId: string, status?: EmployeeStatus | 'ALL', scope?: SupervisorScope | null, search?: string) {
    const searchTrimmed = search?.trim();
    const employees = await prisma.employee.findMany({
      where: {
        clientId,
        ...(status && status !== 'ALL' ? { status } : {}),
        ...(scope ? { role: scope.supervisedRole } : {}),
        ...(searchTrimmed
          ? {
              OR: [
                { firstName: { contains: searchTrimmed, mode: 'insensitive' } },
                { lastName: { contains: searchTrimmed, mode: 'insensitive' } },
                { employeeNumber: { contains: searchTrimmed, mode: 'insensitive' } },
                { email: { contains: searchTrimmed, mode: 'insensitive' } },
                { phone: { contains: searchTrimmed, mode: 'insensitive' } },
                { companyName: { contains: searchTrimmed, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        user: true,
      },
    });

    return employees.sort(compareEmployeesByRoleOrder);
  }

  delete(id: string) {
    return prisma.employee.delete({
      where: {
        id,
      },
    });
  }
}

export const employeeRepository = new EmployeeRepository();
