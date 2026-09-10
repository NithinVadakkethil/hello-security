import { prisma } from '../../database/prisma';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { hashPassword } from '../../common/auth/bcrypt';
import { EnrollManagerDto, ManagerClientDto, EnrolledManagerDto } from './manager.types';
import { UserRole } from '@prisma/client';

export class ManagerMembershipService {
  /**
   * Asserts that a user has active manager membership for a given client.
   * Also permits SUPER_ADMIN globally or CLIENT_ADMIN for their own client.
   */
  async assertManagerClientAccess(userId: string, clientId: string): Promise<void> {
    if (!userId || !clientId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'User ID and Client ID are required for context verification.',
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, clientId: true },
    });

    if (!user) {
      throw new AppError(HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, 'User not found.');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return; // Super admin bypass
    }

    if (user.role === UserRole.CLIENT_ADMIN && user.clientId === clientId) {
      return; // Client admin bypass for their own organization
    }

    const membership = await prisma.managerClientMembership.findFirst({
      where: {
        managerUserId: userId,
        clientId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Access denied: You do not have an active Manager membership for this organization.',
      );
    }
  }

  /**
   * Fetches all active client organization memberships for a logged-in manager.
   */
  async getManagerClients(userId: string): Promise<ManagerClientDto[]> {
    const memberships = await prisma.managerClientMembership.findMany({
      where: {
        managerUserId: userId,
        isActive: true,
        client: {
          isActive: true,
        },
      },
      include: {
        client: {
          include: {
            _count: {
              select: { sites: true },
            },
          },
        },
      },
      orderBy: {
        client: {
          companyName: 'asc',
        },
      },
    });

    return memberships.map((m) => ({
      clientId: m.client.id,
      clientCode: m.client.clientCode,
      companyName: m.client.companyName,
      clientLogoUrl: m.client.clientLogoUrl,
      siteCount: m.client._count.sites,
      isActive: m.isActive,
    }));
  }

  /**
   * Enrolls a manager under a Client Admin organization.
   * If a user account already exists with the normalized email, links the existing account.
   */
  async enrollManager(clientId: string, dto: EnrollManagerDto) {
    if (!dto.email || !dto.name) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Name and Email are required.',
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const name = dto.name.trim();

    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
      include: {
        employee: true,
      },
    });

    if (existingUser) {
      // User exists - check existing membership
      const existingMembership = await prisma.managerClientMembership.findUnique({
        where: {
          managerUserId_clientId: {
            managerUserId: existingUser.id,
            clientId,
          },
        },
      });

      if (existingMembership && existingMembership.isActive) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'This Manager is already enrolled in your organization.',
        );
      }

      await prisma.$transaction(async (tx) => {
        if (existingMembership) {
          await tx.managerClientMembership.update({
            where: { id: existingMembership.id },
            data: { isActive: true },
          });
        } else {
          await tx.managerClientMembership.create({
            data: {
              managerUserId: existingUser.id,
              clientId,
              isActive: true,
            },
          });
        }

        // Upgrade/Ensure role is MANAGER if user was created as operational role
        if (existingUser.role !== UserRole.MANAGER) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { role: UserRole.MANAGER },
          });
          if (existingUser.employeeId) {
            await tx.employee.update({
              where: { id: existingUser.employeeId },
              data: { role: UserRole.MANAGER },
            });
          }
        }
      });

      return {
        isNewUser: false,
        message: 'Existing Manager account found. Added to your organization.',
        userId: existingUser.id,
        email: existingUser.email,
      };
    }

    // New User creation
    const initialPassword = 'OrbitManager@2026';
    const hashedPassword = await hashPassword(initialPassword);

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(' ') || null;

    return await prisma.$transaction(async (tx) => {
      const employeeNumber = `MGR-${Math.floor(1000 + Math.random() * 9000)}`;

      const employee = await tx.employee.create({
        data: {
          clientId,
          employeeNumber,
          firstName,
          lastName,
          email: normalizedEmail,
          role: UserRole.MANAGER,
          designation: 'Manager',
        },
      });

      const user = await tx.user.create({
        data: {
          clientId,
          employeeId: employee.id,
          email: normalizedEmail,
          password: hashedPassword,
          rawPassword: initialPassword,
          role: UserRole.MANAGER,
        },
      });

      await tx.managerClientMembership.create({
        data: {
          managerUserId: user.id,
          clientId,
          isActive: true,
        },
      });

      return {
        isNewUser: true,
        message: 'New Manager account created and enrolled successfully.',
        userId: user.id,
        email: user.email,
        temporaryPassword: initialPassword,
      };
    });
  }

  /**
   * Lists all managers enrolled under a client admin organization.
   */
  async listClientManagers(clientId: string): Promise<EnrolledManagerDto[]> {
    const memberships = await prisma.managerClientMembership.findMany({
      where: {
        clientId,
        isActive: true,
      },
      include: {
        managerUser: {
          include: {
            employee: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return memberships.map((m) => {
      const emp = m.managerUser.employee;
      const name = emp
        ? [emp.firstName, emp.lastName].filter(Boolean).join(' ')
        : m.managerUser.email;

      return {
        id: m.id,
        userId: m.managerUser.id,
        email: m.managerUser.email,
        name,
        createdAt: m.createdAt,
        isActive: m.isActive,
      };
    });
  }

  /**
   * Removes (deactivates) a manager's membership for a specific client.
   * Does NOT delete the global user account.
   */
  async removeManagerMembership(clientId: string, managerUserId: string) {
    const membership = await prisma.managerClientMembership.findUnique({
      where: {
        managerUserId_clientId: {
          managerUserId,
          clientId,
        },
      },
    });

    if (!membership) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Manager membership not found in your organization.',
      );
    }

    await prisma.managerClientMembership.update({
      where: { id: membership.id },
      data: { isActive: false },
    });

    return { success: true, message: 'Manager removed from organization successfully.' };
  }

  /**
   * Super Admin: Lists all Centralized Managers with assigned client organizations.
   */
  async listCentralizedManagers() {
    const managers = await prisma.user.findMany({
      where: {
        OR: [
          { role: UserRole.MANAGER },
          { managerMemberships: { some: {} } },
        ],
      },
      include: {
        employee: true,
        managerMemberships: {
          include: {
            client: {
              select: {
                id: true,
                companyName: true,
                clientCode: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return managers.map((m) => {
      const emp = m.employee;
      const name = emp
        ? [emp.firstName, emp.lastName].filter(Boolean).join(' ')
        : m.email.split('@')[0];

      return {
        id: m.id,
        userId: m.id,
        email: m.email,
        name,
        role: m.role,
        isActive: m.isActive,
        lastLogin: m.lastLogin,
        rawPassword: m.rawPassword,
        createdAt: m.createdAt,
        assignedClients: m.managerMemberships
          .filter((mem) => mem.isActive)
          .map((mem) => ({
            id: mem.client.id,
            companyName: mem.client.companyName,
            clientCode: mem.client.clientCode,
            email: mem.client.email,
          })),
      };
    });
  }

  /**
   * Super Admin: Creates or updates a global Centralized Manager user and assigns selected clients.
   */
  async enrollCentralizedManager(data: {
    name: string;
    email: string;
    password?: string;
    isActive?: boolean;
    clientIds: string[];
  }) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const clientIds = Array.isArray(data.clientIds) ? data.clientIds : [];

    return prisma.$transaction(async (tx) => {
      let user = await tx.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        include: { employee: true },
      });

      let initialPassword = data.password || '';
      let isNewUser = false;

      if (!user) {
        isNewUser = true;
        const crypto = require('crypto');
        initialPassword = data.password || crypto.randomBytes(6).toString('hex');
        const hashedPassword = await hashPassword(initialPassword);

        const primaryClientId = clientIds[0];

        const empCode = `MGR-${Date.now().toString().slice(-6)}`;
        const nameParts = data.name.trim().split(' ');
        const firstName = nameParts[0] || data.name;
        const lastName = nameParts.slice(1).join(' ') || '';

        const employeeData: any = {
          employeeNumber: empCode,
          firstName,
          lastName,
          email: normalizedEmail,
          role: UserRole.MANAGER,
          designation: 'Centralized Manager',
          status: 'ACTIVE',
        };
        if (primaryClientId) {
          employeeData.clientId = primaryClientId;
        }

        const employee = await tx.employee.create({
          data: employeeData,
        });

        user = await tx.user.create({
          data: {
            clientId: primaryClientId,
            employeeId: employee.id,
            email: normalizedEmail,
            password: hashedPassword,
            rawPassword: initialPassword,
            role: UserRole.MANAGER,
            isActive: data.isActive !== undefined ? data.isActive : true,
          },
          include: { employee: true },
        });
      } else {
        if (data.isActive !== undefined) {
          await tx.user.update({
            where: { id: user.id },
            data: { isActive: data.isActive },
          });
        }
      }

      for (const cId of clientIds) {
        const existingMem = await tx.managerClientMembership.findUnique({
          where: {
            managerUserId_clientId: {
              managerUserId: user.id,
              clientId: cId,
            },
          },
        });

        if (existingMem) {
          if (!existingMem.isActive) {
            await tx.managerClientMembership.update({
              where: { id: existingMem.id },
              data: { isActive: true },
            });
          }
        } else {
          await tx.managerClientMembership.create({
            data: {
              managerUserId: user.id,
              clientId: cId,
              isActive: true,
            },
          });
        }
      }

      return {
        success: true,
        isNewUser,
        message: isNewUser
          ? 'Centralized Manager created and assigned successfully.'
          : 'Centralized Manager access updated successfully.',
        userId: user.id,
        email: user.email,
        temporaryPassword: isNewUser ? initialPassword : undefined,
      };
    });
  }

  /**
   * Super Admin: Updates assigned client memberships for a Centralized Manager.
   */
  async updateCentralizedMemberships(userId: string, clientIds: string[]) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'User not found.');
    }

    const selectedSet = new Set(clientIds);

    await prisma.$transaction(async (tx) => {
      const existingMemberships = await tx.managerClientMembership.findMany({
        where: { managerUserId: userId },
      });

      const existingClientIds = new Set(existingMemberships.map((m) => m.clientId));

      for (const mem of existingMemberships) {
        if (!selectedSet.has(mem.clientId)) {
          await tx.managerClientMembership.update({
            where: { id: mem.id },
            data: { isActive: false },
          });
        } else if (!mem.isActive) {
          await tx.managerClientMembership.update({
            where: { id: mem.id },
            data: { isActive: true },
          });
        }
      }

      for (const cId of clientIds) {
        if (!existingClientIds.has(cId)) {
          await tx.managerClientMembership.create({
            data: {
              managerUserId: userId,
              clientId: cId,
              isActive: true,
            },
          });
        }
      }
    });

    return { success: true, message: 'Assigned organizations updated successfully.' };
  }

  /**
   * Super Admin: Activates or deactivates a Centralized Manager account.
   */
  async setCentralizedManagerStatus(userId: string, isActive: boolean) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'User not found.');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    return { success: true, message: `Manager account ${isActive ? 'activated' : 'deactivated'} successfully.` };
  }
}

export const managerMembershipService = new ManagerMembershipService();
