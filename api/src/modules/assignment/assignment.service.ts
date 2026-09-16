import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { prisma } from '../../database/prisma';

import { employeeRepository } from '../employee/employee.repository';
import { gateRepository } from '../gate/gate.repository';
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
      dto.assignmentType ||
      (dto.patrolRouteId || (dto.patrolRouteIds && dto.patrolRouteIds.length > 0)
        ? 'ROUTE'
        : 'DIRECT_CHECKPOINTS');

    let targetRouteIds: string[] = [];

    if (assignmentType === 'ROUTE') {
      targetRouteIds =
        dto.patrolRouteIds && dto.patrolRouteIds.length > 0
          ? dto.patrolRouteIds
          : dto.patrolRouteId
          ? [dto.patrolRouteId]
          : [];

      if (targetRouteIds.length === 0) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'At least one patrol route is required for route assignments.',
        );
      }

      for (const routeId of targetRouteIds) {
        const patrolRoute = await patrolRouteRepository.findById(routeId);

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
            `Patrol route "${patrolRoute.name}" is inactive.`,
          );
        }

        if (patrolRoute.siteId !== dto.siteId) {
          throw new AppError(
            HttpStatus.BAD_REQUEST,
            ErrorCodes.VALIDATION_ERROR,
            `Patrol route "${patrolRoute.name}" does not belong to the selected site.`,
          );
        }
      }
    } else if (assignmentType === 'DIRECT_CHECKPOINTS') {
      if (!dto.gateIds || dto.gateIds.length === 0) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
          'At least one checkpoint must be selected for direct assignment.',
        );
      }

      for (const gateId of dto.gateIds) {
        const gate = await gateRepository.findById(gateId);
        if (!gate) {
          throw new AppError(
            HttpStatus.NOT_FOUND,
            ErrorCodes.NOT_FOUND,
            'Checkpoint not found.',
          );
        }

        if (gate.siteId !== dto.siteId) {
          throw new AppError(
            HttpStatus.BAD_REQUEST,
            ErrorCodes.VALIDATION_ERROR,
            `Checkpoint "${gate.name}" belongs to another site.`,
          );
        }

        if (!gate.isActive) {
          throw new AppError(
            HttpStatus.BAD_REQUEST,
            ErrorCodes.VALIDATION_ERROR,
            'One or more selected checkpoints are inactive and cannot be assigned.',
          );
        }
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

    let createdCount = 0;
    let skippedCount = 0;
    const createdAssignments: any[] = [];

    for (const empId of targetEmployeeIds) {
      const employee = await employeeRepository.findById(empId);

      if (!employee || employee.clientId !== clientId || employee.status !== 'ACTIVE') {
        continue;
      }

      if (assignmentType === 'ROUTE') {
        for (const routeId of targetRouteIds) {
          const existing = await assignmentRepository.findEmployeeActiveAssignmentForRoute(
            empId,
            dto.siteId,
            dto.shiftId,
            routeId,
          );

          if (existing) {
            skippedCount++;
            continue;
          }

          const created = await assignmentRepository.create({
            clientId,
            employeeId: empId,
            siteId: dto.siteId,
            shiftId: dto.shiftId,
            assignmentType,
            patrolRouteId: routeId,
            effectiveFrom: dto.effectiveFrom,
            effectiveTo: dto.effectiveTo,
          });

          createdCount++;
          createdAssignments.push(created);
        }
      } else {
        const created = await assignmentRepository.create({
          clientId,
          employeeId: empId,
          siteId: dto.siteId,
          shiftId: dto.shiftId,
          assignmentType,
          gateIds: dto.gateIds,
          effectiveFrom: dto.effectiveFrom,
          effectiveTo: dto.effectiveTo,
        });

        createdCount++;
        createdAssignments.push(created);
      }
    }

    const totalRequested =
      targetEmployeeIds.length * (assignmentType === 'ROUTE' ? targetRouteIds.length : 1);

    return {
      success: true,
      createdCount,
      skippedCount,
      totalRequested,
      assignments: createdAssignments,
    };
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

  private formatAssignmentWithCompletion(assignment: any) {
    if (!assignment) return assignment;
    const latestSession = assignment.patrolSessions?.[0];
    const lastCompletedAt = latestSession?.endedAt || latestSession?.updatedAt || null;
    return {
      ...assignment,
      lastCompletedAt,
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

    return this.formatAssignmentWithCompletion(assignments[0]);
  }

  async getActiveList(employeeId: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Employee ID is required.',
      );
    }

    const assignments = await assignmentRepository.findEmployeeActiveAssignments(employeeId);
    return assignments.map((a: any) => this.formatAssignmentWithCompletion(a));
  }

  async getEmployeeAllAssignments(employeeId: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Employee ID is required.',
      );
    }

    const assignments = await assignmentRepository.findEmployeeAllAssignments(employeeId);
    return assignments.map((a: any) => this.formatAssignmentWithCompletion(a));
  }

  async listEmployeeSummaries(
    clientId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      role?: string;
    },
  ) {
    const page = query.page ? Math.max(1, Number(query.page)) : 1;
    const limit = query.limit ? Math.max(1, Math.min(100, Number(query.limit))) : 10;
    const search = query.search ? String(query.search) : undefined;
    const status = query.status ? String(query.status) : 'ALL';
    const role = query.role ? String(query.role) : 'ALL';

    return assignmentRepository.listEmployeeSummaries(clientId, {
      page,
      limit,
      search,
      status,
      role,
    });
  }

  async getEmployeeAssignments(clientId: string, employeeId: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Employee ID is required.',
      );
    }

    const result = await assignmentRepository.getEmployeeWithAssignments(
      clientId,
      employeeId,
    );

    if (!result) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Employee not found or access denied.',
      );
    }

    const assignmentsWithCompletion = result.assignments.map((a: any) =>
      this.formatAssignmentWithCompletion(a),
    );

    return {
      employee: result.employee,
      assignments: assignmentsWithCompletion,
    };
  }

  async deactivateEmployeeAssignments(clientId: string, employeeId: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Employee ID is required.',
      );
    }

    const employee = await employeeRepository.findById(employeeId);
    if (!employee || employee.clientId !== clientId) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Employee not found or access denied.',
      );
    }

    const activePatrol = await prisma.patrolSession.findFirst({
      where: {
        clientId,
        assignment: {
          employeeId,
          clientId,
        },
        status: {
          in: ['IN_PROGRESS', 'PAUSED'],
        },
      },
    });

    if (activePatrol) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Assignments cannot be deactivated while this employee has an active patrol session in progress.',
      );
    }

    const result = await assignmentRepository.deactivateEmployeeAssignments(
      clientId,
      employeeId,
    );

    return {
      message: `${result.count} assignment(s) for ${employee.firstName} ${employee.lastName || ''}`.trim() + ' deactivated successfully.',
      deactivatedCount: result.count,
    };
  }

  async activateEmployeeAssignments(clientId: string, employeeId: string) {
    if (!employeeId) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Employee ID is required.',
      );
    }

    const employee = await employeeRepository.findById(employeeId);
    if (!employee || employee.clientId !== clientId) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Employee not found or access denied.',
      );
    }

    const inactiveAssignments = await prisma.guardAssignment.findMany({
      where: {
        employeeId,
        clientId,
        isActive: false,
      },
      include: {
        site: { select: { id: true, name: true, isActive: true } },
        shift: { select: { id: true, name: true, isActive: true } },
        patrolRoute: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (inactiveAssignments.length === 0) {
      return {
        message: 'No inactive assignments found for this employee.',
        activatedCount: 0,
        skippedCount: 0,
      };
    }

    const now = new Date();
    const eligibleIds: string[] = [];
    let skippedCount = 0;

    for (const asg of inactiveAssignments) {
      if (asg.effectiveTo && new Date(asg.effectiveTo) < now) {
        skippedCount++;
        continue;
      }
      if (!asg.site?.isActive || !asg.shift?.isActive) {
        skippedCount++;
        continue;
      }
      if (asg.patrolRouteId && !asg.patrolRoute?.isActive) {
        skippedCount++;
        continue;
      }
      eligibleIds.push(asg.id);
    }

    if (eligibleIds.length === 0) {
      return {
        message: 'No eligible assignments could be activated (all inactive assignments are expired or associated with inactive sites/shifts/routes).',
        activatedCount: 0,
        skippedCount,
      };
    }

    const result = await assignmentRepository.activateEmployeeAssignments(
      clientId,
      eligibleIds,
    );

    const skippedMsg = skippedCount > 0 ? ` (${skippedCount} expired/inactive assignment(s) skipped)` : '';
    return {
      message: `${result.count} assignment(s) for ${employee.firstName} ${employee.lastName || ''}`.trim() + ` activated successfully${skippedMsg}.`,
      activatedCount: result.count,
      skippedCount,
    };
  }
}

export const assignmentService = new AssignmentService();

