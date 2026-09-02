import { NextFunction, Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { verifyReportDownloadToken } from '../../common/auth/report-token';
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

  async getSingleInspectionReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const clientId = isSuperAdmin || !user.tenantId ? undefined : user.tenantId;

      const data = await reportService.getSingleInspectionReport(req.params.id as string, clientId);
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getPatrolPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const clientId = isSuperAdmin || !user.tenantId ? undefined : user.tenantId;

      const result = await reportService.getPatrolPdf(req.params.id as string, clientId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(HttpStatus.OK).send(result.pdfBuffer);
    } catch (error) {
      return next(error);
    }
  }

  async publicDownloadPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Download token is required.',
        });
      }

      const decoded = verifyReportDownloadToken(token);
      const result = await reportService.getPatrolPdf(decoded.patrolSessionId, decoded.clientId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(HttpStatus.OK).send(result.pdfBuffer);
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
