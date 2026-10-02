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

  async generateSummaryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const query = req.query || {};
      const body = req.body || {};
      const params = {
        periodType: ((query.periodType || body.periodType || 'DAILY') as string).toUpperCase() as any,
        date: (query.date || body.date) as string | undefined,
        month: (query.month || body.month) as string | undefined,
        startDate: (query.startDate || body.startDate) as string | undefined,
        endDate: (query.endDate || body.endDate) as string | undefined,
        clientId: (query.clientId || body.clientId) as string | undefined,
        siteId: (query.siteId || body.siteId) as string | undefined,
        employeeId: (query.employeeId || body.employeeId) as string | undefined,
        user,
      };

      const { summaryReportService } = require('./summary-report.service');
      const dataset = await summaryReportService.generateReportDataset(params);

      return res.status(HttpStatus.OK).json({
        success: true,
        data: dataset,
      });
    } catch (error) {
      return next(error);
    }
  }

  async downloadSummaryPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const query = req.query || {};
      const body = req.body || {};
      const params = {
        periodType: ((query.periodType || body.periodType || 'DAILY') as string).toUpperCase() as any,
        date: (query.date || body.date) as string | undefined,
        month: (query.month || body.month) as string | undefined,
        startDate: (query.startDate || body.startDate) as string | undefined,
        endDate: (query.endDate || body.endDate) as string | undefined,
        clientId: (query.clientId || body.clientId) as string | undefined,
        siteId: (query.siteId || body.siteId) as string | undefined,
        employeeId: (query.employeeId || body.employeeId) as string | undefined,
        user,
      };

      const { summaryReportService } = require('./summary-report.service');
      const { pdfGeneratorService } = require('./pdf-generator.service');

      const dataset = await summaryReportService.generateReportDataset(params);
      const pdfBuffer = await pdfGeneratorService.generatePdf(dataset);

      const dateTag = params.date || params.month || new Date().toISOString().split('T')[0];
      const filename = `HelloOrbit_${params.periodType}_Report_${dateTag}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      return next(error);
    }
  }

  async downloadSummaryExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const query = req.query || {};
      const body = req.body || {};
      const params = {
        periodType: ((query.periodType || body.periodType || 'DAILY') as string).toUpperCase() as any,
        date: (query.date || body.date) as string | undefined,
        month: (query.month || body.month) as string | undefined,
        startDate: (query.startDate || body.startDate) as string | undefined,
        endDate: (query.endDate || body.endDate) as string | undefined,
        clientId: (query.clientId || body.clientId) as string | undefined,
        siteId: (query.siteId || body.siteId) as string | undefined,
        employeeId: (query.employeeId || body.employeeId) as string | undefined,
        user,
      };

      const { summaryReportService } = require('./summary-report.service');
      const { excelGeneratorService } = require('./excel-generator.service');

      const dataset = await summaryReportService.generateReportDataset(params);
      const excelBuffer = excelGeneratorService.generateExcel(dataset);

      const dateTag = params.date || params.month || new Date().toISOString().split('T')[0];
      const filename = `HelloOrbit_${params.periodType}_Report_${dateTag}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(HttpStatus.OK).send(excelBuffer);
    } catch (error) {
      return next(error);
    }
  }
}

export const reportController = new ReportController();
