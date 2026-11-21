import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';
import { CurrentUser } from './current-user';

/**
 * Verifies that an authenticated user is allowed to access a resource belonging
 * to `resourceClientId`. Allows SUPER_ADMIN unconditionally, matches `user.tenantId`
 * directly, and checks active ManagerClientMembership for centralized MANAGERs.
 */
export async function assertTenantAccess(
  user: CurrentUser | undefined,
  resourceClientId: string | null | undefined,
  deniedMessage = 'Access denied. Resource does not belong to your organization.',
): Promise<void> {
  if (!user) return;
  if (user.role === UserRole.SUPER_ADMIN) return;

  if (!resourceClientId) {
    throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, deniedMessage);
  }

  if (user.tenantId && user.tenantId === resourceClientId) {
    return;
  }

  if (user.role === UserRole.MANAGER) {
    const membership = await prisma.managerClientMembership.findFirst({
      where: {
        managerUserId: user.id,
        clientId: resourceClientId,
        isActive: true,
      },
      select: { id: true },
    });
    if (membership) return;
  }

  throw new AppError(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, deniedMessage);
}

/**
 * Resolves the effective clientId list a user can operate on when performing scoped
 * lookups (returns null for unrestricted SUPER_ADMIN).
 */
export async function getAuthorizedClientIds(user: CurrentUser): Promise<string[] | null> {
  if (user.role === UserRole.SUPER_ADMIN) return null;

  const ids = new Set<string>();
  if (user.tenantId) ids.add(user.tenantId);

  if (user.role === UserRole.MANAGER) {
    const memberships = await prisma.managerClientMembership.findMany({
      where: { managerUserId: user.id, isActive: true },
      select: { clientId: true },
    });
    for (const m of memberships) {
      ids.add(m.clientId);
    }
  }

  return Array.from(ids);
}

