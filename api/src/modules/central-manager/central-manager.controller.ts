import { NextFunction, Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { centralManagerService } from './central-manager.service';

export class CentralManagerController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const { dateFrom, dateTo, clientId } = req.query as any;

      const result = await centralManagerService.getDashboard(user, {
        dateFrom,
        dateTo,
        clientId,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getClientDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const clientId = req.params.clientId as string;
      const { dateFrom, dateTo } = req.query as any;

      const result = await centralManagerService.getClientDashboard(user, clientId, {
        dateFrom,
        dateTo,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const { dateFrom, dateTo, clientId, siteId, role, status, search, page, limit } = req.query as any;

      const result = await centralManagerService.getEmployees(user, {
        dateFrom,
        dateTo,
        clientId,
        siteId,
        role,
        status,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 25,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getEmployeeDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const employeeId = req.params.id as string;

      const result = await centralManagerService.getEmployeeDetails(user, employeeId);

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getPatrols(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const type = (req.query.type as 'ACTIVE' | 'COMPLETED') || 'ACTIVE';
      const { dateFrom, dateTo, clientId, siteId, search, page, limit } = req.query as any;

      const result = await centralManagerService.getPatrols(user, type, {
        dateFrom,
        dateTo,
        clientId,
        siteId,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 25,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getObservations(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const { dateFrom, dateTo, clientId, status, search, page, limit } = req.query as any;

      const result = await centralManagerService.getObservations(user, {
        dateFrom,
        dateTo,
        clientId,
        status,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 25,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getSnags(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const { dateFrom, dateTo, clientId, siteId, status, category, search, page, limit } = req.query as any;

      const result = await centralManagerService.getSnags(user, {
        dateFrom,
        dateTo,
        clientId,
        siteId,
        status,
        category,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 25,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const data = await centralManagerService.getOrganizations(user);
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getEmployeeRoleCounts(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const clientId = req.query.clientId as string;
      const data = await centralManagerService.getEmployeeRoleCounts(user, clientId);
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getReports(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const {
        dateFrom,
        dateTo,
        clientId,
        siteId,
        employeeId,
        gateId,
        status,
        search,
        page,
        limit,
        datePreset,
        startDate,
        endDate,
      } = req.query as any;

      const result = await centralManagerService.getReports(user, {
        dateFrom,
        dateTo,
        clientId,
        siteId,
        employeeId,
        gateId,
        status,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 25,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        datePreset,
        startDate,
        endDate,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getSingleReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const id = req.params.id as string;
      const clientId = req.query.clientId as string;

      const data = await centralManagerService.getSingleReport(user, id, clientId);
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getReportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const id = req.params.id as string;
      const clientId = req.query.clientId as string;

      const result = await centralManagerService.getReportPdf(user, id, clientId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(HttpStatus.OK).send(result.pdfBuffer);
    } catch (error) {
      return next(error);
    }
  }
}

export const centralManagerController = new CentralManagerController();
