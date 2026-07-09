import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { ENTITY } from '../../common/constants/entities';
import { PREFIX } from '../../common/constants/prefixes';
import { counterService } from '../../common/counter/counter.service';
import { generateCode } from '../../common/utils/code-generator';

import { employeeRepository } from '../employee/employee.repository';
import { patrolRouteRepository } from '../patrol-route/patrol-route.repository';
import { shiftRepository } from '../shift/shift.repository';
import { siteRepository } from '../site/site.repository';

import { assignmentRepository } from './assignment.repository';
import { CreateAssignmentDto, UpdateAssignmentDto } from './assignment.types';

export class AssignmentService {
  async create(clientId: string, dto: CreateAssignmentDto) {
    // Employee
    const employee = await employeeRepository.findById(dto.employeeId);

    if (!employee || employee.clientId !== clientId) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Employee not found.',
      );
    }

    if (employee.status !== 'ACTIVE') {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Employee is inactive.',
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

    // Patrol Route
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

    // Route must belong to selected site
    if (patrolRoute.siteId !== dto.siteId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Selected patrol route does not belong to the selected site.',
      );
    }

    // Date validation
    if (dto.effectiveTo && dto.effectiveTo < dto.effectiveFrom) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Effective To must be after Effective From.',
      );
    }

    // Employee can have only one active assignment
    const existing = await assignmentRepository.findEmployeeActiveAssignment(
      dto.employeeId,
    );

    if (existing) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'Employee already has an active assignment.',
      );
    }

    // Assignment Code
    const sequence = await counterService.next(ENTITY.ASSIGNMENT);

    const assignmentCode = generateCode(PREFIX.ASSIGNMENT, sequence);

    return assignmentRepository.create({
      clientId,
      assignmentCode,
      employeeId: dto.employeeId,
      siteId: dto.siteId,
      shiftId: dto.shiftId,
      patrolRouteId: dto.patrolRouteId,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo,
    });
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
}

export const assignmentService = new AssignmentService();
