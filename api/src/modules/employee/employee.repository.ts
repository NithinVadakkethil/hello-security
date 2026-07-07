import { EmployeeStatus, Prisma } from '@prisma/client';

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

  list(clientId: string, status?: EmployeeStatus | 'ALL') {
    return prisma.employee.findMany({
      where: {
        clientId,
        ...(status && status !== 'ALL' ? { status } : {}),
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
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
