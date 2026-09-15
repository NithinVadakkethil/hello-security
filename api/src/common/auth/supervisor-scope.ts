import { UserRole, Prisma } from '@prisma/client';
import { CurrentUser } from './current-user';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';

export interface SupervisorScope {
  clientId: string;
  supervisedRole: UserRole;
}

export function getSupervisorScope(user: CurrentUser): SupervisorScope | null {
  if (user.role !== UserRole.SUPERVISOR) {
    return null;
  }

  if (!user.supervisedRole) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
      'Supervisor operational scope has not been configured. Contact administrator.',
    );
  }

  return {
    clientId: user.tenantId!,
    supervisedRole: user.supervisedRole,
  };
}

export function buildSupervisorPatrolWhere(
  scope: SupervisorScope | null,
  baseWhere: Prisma.PatrolSessionWhereInput = {},
): Prisma.PatrolSessionWhereInput {
  if (!scope) return baseWhere;

  return {
    ...baseWhere,
    clientId: scope.clientId,
    assignment: {
      employee: {
        role: scope.supervisedRole,
      },
    },
  };
}

export function buildSupervisorObservationWhere(
  scope: SupervisorScope | null,
  baseWhere: Prisma.IncidentWhereInput = {},
): Prisma.IncidentWhereInput {
  if (!scope) return baseWhere;

  return {
    ...baseWhere,
    clientId: scope.clientId,
    employee: {
      role: scope.supervisedRole,
    },
  };
}

export function buildSupervisorSnagWhere(
  scope: SupervisorScope | null,
  baseWhere: Prisma.SnagWhereInput = {},
): Prisma.SnagWhereInput {
  if (!scope) return baseWhere;

  return {
    ...baseWhere,
    clientId: scope.clientId,
    employee: {
      role: scope.supervisedRole,
    },
  };
}

export function buildSupervisorEmployeeWhere(
  scope: SupervisorScope | null,
  baseWhere: Prisma.EmployeeWhereInput = {},
): Prisma.EmployeeWhereInput {
  if (!scope) return baseWhere;

  return {
    ...baseWhere,
    clientId: scope.clientId,
    role: scope.supervisedRole,
  };
}
