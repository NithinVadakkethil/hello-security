import { NextFunction, Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { reportService } from './report.service';
import { reportQuerySchema } from './report.types';

export class ReportController {
  async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const query = reportQuerySchema.parse(req.query);
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const clientId = isSuperAdmin || !user.tenantId ? undefined : user.tenantId;

      const data = await reportService.getAnalytics(clientId, query);
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getInspectionReports(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const query = reportQuerySchema.parse(req.query);
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const clientId = isSuperAdmin || !user.tenantId ? undefined : user.tenantId;

      const data = await reportService.getInspectionReports(clientId, query);
      return res.status(HttpStatus.OK).json({
        success: true,
        data: data.data,
        pagination: data.pagination,
      });
    } catch (error) {
      return next(error);
    }
  }

  async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const query = reportQuerySchema.parse(req.query);
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const clientId = isSuperAdmin || !user.tenantId ? undefined : user.tenantId;

      const csvData = await reportService.generateCsv(clientId, query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=inspection_report_${Date.now()}.csv`);
      return res.status(HttpStatus.OK).send(csvData);
    } catch (error) {
      return next(error);
    }
  }
}

export const reportController = new ReportController();
