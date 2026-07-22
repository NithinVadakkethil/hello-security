import { randomBytes } from 'crypto';

import { EmployeeStatus, Prisma } from '@prisma/client';

import { hashPassword } from '../../common/auth/bcrypt';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { prisma } from '../../database/prisma';

import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';
import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';

import { employeeRepository } from './employee.repository';
import { CreateEmployeeDto, UpdateEmployeeDto } from './employee.types';

export class EmployeeService {
  async create(clientId: string, dto: CreateEmployeeDto) {
    // Validate Employee Creation Limit
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { maxEmployees: true },
    });

    if (client && client.maxEmployees !== null && client.maxEmployees !== undefined) {
      const currentCount = await prisma.employee.count({
        where: { clientId },
      });

      if (currentCount >= client.maxEmployees) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          `Employee creation limit reached. Maximum allowed: ${client.maxEmployees}. Current count: ${currentCount}.`,
        );
      }
    }

    // Check duplicate employee email
    if (dto.email) {
      const existingEmployee = await employeeRepository.findByEmail(dto.email);

      if (existingEmployee) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          'Employee email already exists.',
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

      if (existingUser) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          'User email already exists.',
        );
      }
    }

    // Generate employee number
    let sequence = await counterService.next(ENTITY.EMPLOYEE, clientId);
    let employeeNumber = generateCode(PREFIX.EMPLOYEE, sequence);

    let existingEmpCode = await prisma.employee.findFirst({ where: { clientId, employeeNumber } });

    while (existingEmpCode) {
      sequence = await counterService.next(ENTITY.EMPLOYEE, clientId);
      employeeNumber = generateCode(PREFIX.EMPLOYEE, sequence);
      existingEmpCode = await prisma.employee.findFirst({ where: { clientId, employeeNumber } });
    }

    // Generate temporary password
    const temporaryPassword = randomBytes(6).toString('hex');

    const hashedPassword = await hashPassword(temporaryPassword);

    const employee = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const createdEmployee = await tx.employee.create({
          data: {
            clientId,
            employeeNumber,

            firstName: dto.firstName,
            lastName: dto.lastName,

            email: dto.email,
            phone: dto.phone,

            designation: dto.designation,

            joiningDate: dto.joiningDate,

            identificationMethod: dto.identificationMethod,
          },
        });

        if (dto.email) {
          await tx.user.create({
            data: {
              clientId,
              employeeId: createdEmployee.id,
              email: dto.email,
              password: hashedPassword,
              rawPassword: temporaryPassword,
              role: dto.role,
            },
          });
        }

        return createdEmployee;
      },
    );

    return {
      employee,
      temporaryPassword: dto.email ? temporaryPassword : null,
    };
  }

  async list(clientId: string, status?: EmployeeStatus | 'ALL') {
    return employeeRepository.list(clientId, status);
  }

  async get(id: string) {
    const employee = await employeeRepository.findById(id);

    if (!employee) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Employee not found.',
      );
    }

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.get(id);

    return employeeRepository.update(id, dto);
  }

  async activate(id: string) {
    await this.get(id);

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          status: 'ACTIVE',
        },
      });

      await tx.user.updateMany({
        where: {
          employeeId: id,
        },
        data: {
          isActive: true,
        },
      });
    });

    return {
      message: 'Employee activated successfully.',
    };
  }

  async deactivate(id: string) {
    await this.get(id);

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          status: 'INACTIVE',
        },
      });

      await tx.user.updateMany({
        where: {
          employeeId: id,
        },
        data: {
          isActive: false,
        },
      });
    });

    return {
      message: 'Employee deactivated successfully.',
    };
  }

  async delete(id: string) {
    await this.get(id);

    return employeeRepository.delete(id);
  }
}

export const employeeService = new EmployeeService();
