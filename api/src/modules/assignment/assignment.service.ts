import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';


import { employeeRepository } from '../employee/employee.repository';
import { patrolRouteRepository } from '../patrol-route/patrol-route.repository';
import { shiftRepository } from '../shift/shift.repository';
import { siteRepository } from '../site/site.repository';

import { assignmentRepository } from './assignment.repository';
import { CreateAssignmentDto, UpdateAssignmentDto } from './assignment.types';

export class AssignmentService {
  async create(clientId: string, dto: CreateAssignmentDto) {
    const targetEmployeeIds =
      dto.employeeIds && dto.employeeIds.length > 0
        ? dto.employeeIds
        : dto.employeeId
        ? [dto.employeeId]
        : [];

    if (targetEmployeeIds.length === 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'At least one guard employee must be selected.',
      );
    }

    // Site
    const site = await siteRepository.findById(dto.siteId);

    if (!site || site.clientId !== clientId) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Site not found.',
      );
    }

    if (!site.isActive) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Site is inactive.',
      );
    }

    // Shift
    const shift = await shiftRepository.findById(dto.shiftId);

    if (!shift || shift.clientId !== clientId) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Shift not found.',
      );
    }

    if (!shift.isActive) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Shift is inactive.',
      );
    }

    const assignmentType =
      dto.assignmentType || (dto.patrolRouteId ? 'ROUTE' : 'DIRECT_CHECKPOINTS');

    if (assignmentType === 'ROUTE') {
      if (!dto.patrolRouteId) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'Patrol route is required for route assignments.',
        );
      }
      const patrolRoute = await patrolRouteRepository.findById(dto.patrolRouteId);

      if (!patrolRoute || patrolRoute.clientId !== clientId) {
        throw new AppError(
          HttpStatus.NOT_FOUND,
          ErrorCodes.NOT_FOUND,
          'Patrol route not found.',
        );
      }

      if (!patrolRoute.isActive) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'Patrol route is inactive.',
        );
      }

      if (patrolRoute.siteId !== dto.siteId) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'Selected patrol route does not belong to the selected site.',
        );
      }
    } else if (assignmentType === 'DIRECT_CHECKPOINTS') {
      if (!dto.gateIds || dto.gateIds.length === 0) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'At least one checkpoint must be selected for direct assignment.',
        );
      }
    }

    // Date validation
    if (dto.effectiveTo && dto.effectiveTo < dto.effectiveFrom) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Effective To must be after Effective From.',
      );
    }

    const createdAssignments = [];

    for (const empId of targetEmployeeIds) {
      const employee = await employeeRepository.findById(empId);

      if (!employee || employee.clientId !== clientId || employee.status !== 'ACTIVE') {
        continue;
      }

      const created = await assignmentRepository.create({
        clientId,
        employeeId: empId,
        siteId: dto.siteId,
        shiftId: dto.shiftId,
        assignmentType,
        patrolRouteId: assignmentType === 'ROUTE' ? dto.patrolRouteId : null,
        gateIds: assignmentType === 'DIRECT_CHECKPOINTS' ? dto.gateIds : undefined,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo,
      });

      createdAssignments.push(created);
    }

    return createdAssignments.length === 1 ? createdAssignments[0] : createdAssignments;
  }

  async list(clientId: string, isActive?: boolean) {
    return assignmentRepository.list(clientId, isActive);
  }

  async get(id: string) {
    const assignment = await assignmentRepository.findById(id);

    if (!assignment) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Assignment not found.',
      );
    }

    return assignment;
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    await this.get(id);

    return assignmentRepository.update(id, dto);
  }

  async activate(id: string) {
    await this.get(id);

    await assignmentRepository.activate(id);

    return {
      message: 'Assignment activated successfully.',
    };
  }

  async deactivate(id: string) {
    await this.get(id);

    await assignmentRepository.deactivate(id);

    return {
      message: 'Assignment deactivated successfully.',
    };
  }

  async getActive(employeeId: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Employee ID is required.',
      );
    }
    const assignments = await assignmentRepository.findEmployeeActiveAssignments(employeeId);

    if (!assignments || assignments.length === 0) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'No active assignment found for this employee.',
      );
    }

    return assignments[0];
  }

  async getActiveList(employeeId: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Employee ID is required.',
      );
    }

    return assignmentRepository.findEmployeeActiveAssignments(employeeId);
  }

  async getEmployeeAllAssignments(employeeId: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Employee ID is required.',
      );
    }

    return assignmentRepository.findEmployeeAllAssignments(employeeId);
  }
}

export const assignmentService = new AssignmentService();
