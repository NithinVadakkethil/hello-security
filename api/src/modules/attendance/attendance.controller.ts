import { NextFunction, Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { attendanceService } from './attendance.service';
import { AttendanceFilterQueryDto } from './attendance.types';

export class AttendanceController {
  private parseFilterQuery(req: Request): AttendanceFilterQueryDto {
    return {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 15,
      search: req.query.search as string | undefined,
      clientId: req.query.clientId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
      date: req.query.date as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      datePreset: req.query.datePreset as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = currentUser(req);
      const query = this.parseFilterQuery(req);

      const result = await attendanceService.listAttendance(user, query);

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          records: result.records,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
          page: result.pagination.page,
          limit: result.pagination.limit,
          metrics: result.metrics,
        },
        pagination: result.pagination,
        metrics: result.metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = currentUser(req);
      const { id } = req.params;

      const record = await attendanceService.getAttendanceById(user, id as string);

      res.status(HttpStatus.OK).json({
        success: true,
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = currentUser(req);
      const { employeeId, assignmentId, siteId, shiftId, businessDate } = req.body;

      const empId = employeeId || (user as any).employeeId;
      if (!empId) {
        throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'Employee ID is required for attendance check-in.');
      }

      const record = await attendanceService.recordCheckIn(user, {
        employeeId: empId,
        assignmentId,
        siteId,
        shiftId,
        businessDate,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: 'Attendance check-in recorded successfully.',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = currentUser(req);
      const { employeeId, assignmentId, businessDate } = req.body;

      const empId = employeeId || (user as any).employeeId;
      if (!empId) {
        throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'Employee ID is required for attendance check-out.');
      }

      const record = await attendanceService.recordCheckOut(user, {
        employeeId: empId,
        assignmentId,
        businessDate,
      });

      res.status(HttpStatus.OK).json({
        success: true,
        message: 'Attendance check-out recorded successfully.',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  async exportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = currentUser(req);
      const query = this.parseFilterQuery(req);

      const { buffer, filename, mimeType } = await attendanceService.exportAttendanceReport(user, query, 'pdf');

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.status(HttpStatus.OK).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async exportExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = currentUser(req);
      const query = this.parseFilterQuery(req);

      const { buffer, filename, mimeType } = await attendanceService.exportAttendanceReport(user, query, 'excel');

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.status(HttpStatus.OK).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async export(req: Request, res: Response, next: NextFunction): Promise<void> {
    const format = (req.query.format as string)?.toLowerCase() === 'excel' ? 'excel' : 'pdf';
    if (format === 'excel') {
      return this.exportExcel(req, res, next);
    }
    return this.exportPdf(req, res, next);
  }
}

export const attendanceController = new AttendanceController();
