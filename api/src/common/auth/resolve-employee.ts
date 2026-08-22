import { prisma } from '../../database/prisma';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';
import { CurrentUser } from './current-user';

export async function resolveEmployeeId(user: CurrentUser): Promise<string> {
  if (user.employeeId) {
    return user.employeeId;
  }

  if (user.email) {
    const empByEmail = await prisma.employee.findFirst({
      where: { email: user.email },
      select: { id: true },
    });
    if (empByEmail) {
      return empByEmail.id;
    }
  }

  const empByUserId = await prisma.employee.findFirst({
    where: { user: { id: user.id } },
    select: { id: true },
  });

  if (empByUserId) {
    return empByUserId.id;
  }

  throw new AppError(
    HttpStatus.NOT_FOUND,
    ErrorCodes.NOT_FOUND,
    'No active employee profile is linked to this user account.',
  );
}
