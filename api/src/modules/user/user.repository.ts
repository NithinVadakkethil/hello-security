import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

export class UserRepository {
  async list(skip: number, take: number, search?: string, role?: string, clientId?: string) {
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.email = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role) {
      where.role = role as any;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    return prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        email: true,
        role: true,
        clientId: true,
        employeeId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });
  }

  async count(search?: string, role?: string, clientId?: string) {
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.email = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role) {
      where.role = role as any;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    return prisma.user.count({ where });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        clientId: true,
        employeeId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        role: true,
        clientId: true,
        employeeId: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, data: Prisma.UserUncheckedUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        clientId: true,
        employeeId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}

export const userRepository = new UserRepository();
