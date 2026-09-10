import { UserRole } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';
import { prisma } from '../../database/prisma';

/**
 * Resolves all active assigned client IDs for a given Centralized Manager user.
 */
export async function getCentralManagerAssignedClientIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  const memberships = await prisma.managerClientMembership.findMany({
    where: {
      managerUserId: userId,
      isActive: true,
    },
    select: {
      clientId: true,
    },
  });

  return memberships.map((m) => m.clientId);
}

/**
 * Verifies if the authenticated manager user has access to targetClientId.
 * Throws 403 Forbidden if unassigned.
 */
export async function assertCentralManagerClientAccess(
  user: { id: string; role: string },
  targetClientId?: string,
): Promise<string[]> {
  const assignedClientIds = await getCentralManagerAssignedClientIds(user.id);

  if (user.role === UserRole.SUPER_ADMIN) {
    if (targetClientId) return [targetClientId];
    const allClients = await prisma.client.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return allClients.map((c) => c.id);
  }

  if (assignedClientIds.length === 0) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
      'No active Client Admin organizations are assigned to your Manager account.',
    );
  }

  if (targetClientId) {
    if (!assignedClientIds.includes(targetClientId)) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Access denied. You are not authorized to view operations for this Client Admin organization.',
      );
    }
    return [targetClientId];
  }

  return assignedClientIds;
}
