import { Request, Response } from 'express';
import { mandatoryPatrolService } from './mandatory-patrol.service';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';

export class MandatoryPatrolController {
  async getEmployeeSchedule(req: Request, res: Response) {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
      throw new AppError(HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, 'Employee account required.');
    }

    const schedule = await mandatoryPatrolService.getEmployeeMandatorySchedule(employeeId);

    return res.status(HttpStatus.OK).json({
      success: true,
      data: schedule,
    });
  }

  async getAssignmentMandatoryPatrols(req: Request, res: Response) {
    const assignmentId = req.params.assignmentId as string;

    const items = await mandatoryPatrolService.getAssignmentMandatoryPatrols(assignmentId);

    return res.status(HttpStatus.OK).json({
      success: true,
      data: items,
    });
  }
}

export const mandatoryPatrolController = new MandatoryPatrolController();
