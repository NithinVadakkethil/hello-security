import { NextFunction, Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { verifyReportDownloadToken } from '../../common/auth/report-token';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { logger } from '../../common/logger/logger';
import { reportService } from './report.service';
import { reportQuerySchema } from './report.types';
import { summaryReportService } from './summary-report.service';
import { pdfGeneratorService } from './pdf-generator.service';
import { excelGeneratorService } from './excel-generator.service';

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
      if (req.params.id === 'employee-patrols') {
        return this.getEmployeePatrols(req, res, next);
      }
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

  async getMissedCheckpoints(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const clientId = isSuperAdmin || !user.tenantId ? (req.query.clientId as string) : user.tenantId;

      const data = await reportService.getPatrolMissedCheckpoints(req.params.id as string, clientId);
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

  private extractSummaryParams(req: Request) {
    const user = currentUser(req);
    const query = req.query || {};
    const body = req.body || {};
    const periodType = ((query.reportType || query.periodType || body.reportType || body.periodType || 'DAILY') as string).toUpperCase() as any;
    const startDate = (query.startDate || query.fromDate || body.startDate || body.fromDate) as string | undefined;
    const endDate = (query.endDate || query.toDate || body.endDate || body.toDate) as string | undefined;

    return {
      periodType,
      date: (query.date || body.date) as string | undefined,
      month: (query.month || body.month) as string | undefined,
      startDate,
      endDate,
      fromDate: startDate,
      toDate: endDate,
      clientId: (query.clientId || body.clientId) as string | undefined,
      siteId: (query.siteId || body.siteId) as string | undefined,
      employeeId: (query.employeeId || body.employeeId) as string | undefined,
      role: (query.role || query.roleId || body.role || body.roleId) as string | undefined,
      shiftId: (query.shiftId || body.shiftId) as string | undefined,
      user,
    };
  }

  async generateSummaryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const params = this.extractSummaryParams(req);
      const dataset = await summaryReportService.generateReportDataset(params);

      return res.status(HttpStatus.OK).json({
        success: true,
        data: dataset,
      });
    } catch (error: any) {
      logger.error({ error, query: req.query }, 'Failed to generate summary report');
      if (error instanceof AppError) {
        return next(error);
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCodes.UNKNOWN_ERROR,
          message: 'Failed to generate periodic report. Please verify your filter criteria and try again.',
        },
      });
    }
  }

  async downloadSummaryPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const params = this.extractSummaryParams(req);
      const dataset = await summaryReportService.generateReportDataset(params);
      const pdfBuffer = await pdfGeneratorService.generatePdf(dataset);

      const dateTag =
        params.periodType === 'CUSTOM'
          ? `${params.startDate || 'start'}_to_${params.endDate || 'end'}`
          : params.date || params.month || new Date().toISOString().split('T')[0];
      const empTag = dataset.metadata.employeeName
        ? `_${dataset.metadata.employeeName.replace(/\s+/g, '_')}`
        : dataset.metadata.roleLabel && dataset.metadata.roleLabel !== 'All Roles'
        ? `_${dataset.metadata.roleLabel.replace(/\s+/g, '_')}`
        : '';
      const filename = `HelloOrbit_${params.periodType}_Report${empTag}_${dateTag}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error: any) {
      logger.error({ error, query: req.query }, 'Failed to download summary PDF');
      if (error instanceof AppError) {
        return next(error);
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCodes.UNKNOWN_ERROR,
          message: 'Failed to generate PDF document. Please try again later.',
        },
      });
    }
  }

  async downloadSummaryExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const params = this.extractSummaryParams(req);
      const dataset = await summaryReportService.generateReportDataset(params);
      const excelBuffer = excelGeneratorService.generateExcel(dataset);

      const dateTag =
        params.periodType === 'CUSTOM'
          ? `${params.startDate || 'start'}_to_${params.endDate || 'end'}`
          : params.date || params.month || new Date().toISOString().split('T')[0];
      const empTag = dataset.metadata.employeeName
        ? `_${dataset.metadata.employeeName.replace(/\s+/g, '_')}`
        : dataset.metadata.roleLabel && dataset.metadata.roleLabel !== 'All Roles'
        ? `_${dataset.metadata.roleLabel.replace(/\s+/g, '_')}`
        : '';
      const filename = `HelloOrbit_${params.periodType}_Report${empTag}_${dateTag}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(HttpStatus.OK).send(excelBuffer);
    } catch (error: any) {
      logger.error({ error, query: req.query }, 'Failed to download summary Excel');
      if (error instanceof AppError) {
        return next(error);
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCodes.UNKNOWN_ERROR,
          message: 'Failed to generate Excel spreadsheet. Please try again later.',
        },
      });
    }
  }

  async getEmployeePatrols(req: Request, res: Response, next: NextFunction) {
    try {
      const params = this.extractSummaryParams(req);
      const query = req.query as any;

      const cleanFilterVal = (val?: string) => {
        if (!val || typeof val !== 'string') return undefined;
        const trimmed = val.trim();
        if (
          trimmed === '' ||
          trimmed.toLowerCase() === 'all' ||
          trimmed.toLowerCase() === 'null' ||
          trimmed.toLowerCase() === 'undefined'
        ) {
          return undefined;
        }
        return trimmed;
      };

      const rawEmpId = (query.employeeId || params.employeeId) as string;
      const result = await summaryReportService.getEmployeeCompletedPatrols({
        ...params,
        employeeId: cleanFilterVal(rawEmpId),
        shiftId: cleanFilterVal(query.shiftId || params.shiftId),
        siteId: cleanFilterVal(query.siteId || params.siteId),
        role: cleanFilterVal(query.role || params.role),
        completionStatus: cleanFilterVal(query.completionStatus) as any,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error({ error, query: req.query }, 'Failed to fetch employee completed patrols');
      return next(error);
    }
  }
}

export const reportController = new ReportController();
