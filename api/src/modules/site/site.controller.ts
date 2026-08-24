import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { createSiteSchema, updateSiteSchema } from './site.schema';
import { siteService } from './site.service';
import { siteImportService } from './site-import.service';

export class SiteController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);

      const body = createSiteSchema.parse(req.body);

      const result = await siteService.create(user.tenantId!, body);

      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);

      const isActive =
        req.query.isActive === undefined
          ? undefined
          : req.query.isActive === 'true';

      const sites = await siteService.list(user.tenantId!, isActive);

      return res.json({
        success: true,
        data: sites,
      });
    } catch (error) {
      return next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const site = await siteService.get(req.params.id as string);

      return res.json({
        success: true,
        data: site,
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateSiteSchema.parse(req.body);

      const site = await siteService.update(req.params.id as string, body);

      return res.json({
        success: true,
        data: site,
      });
    } catch (error) {
      return next(error);
    }
  }

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await siteService.activate(req.params.id as string);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await siteService.deactivate(req.params.id as string);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async downloadImportTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = (req.params.id || req.query.siteId) as string | undefined;
      const { buffer } = await siteImportService.generateTemplateBuffer(siteId);

      const filename = siteId ? `checkpoint_import_site_${siteId}.xlsx` : 'checkpoint_import_template.xlsx';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  }

  async validateImportCheckpoints(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.id as string;
      const file = req.file;
      if (!file) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'No file uploaded.',
        });
      }

      const result = await siteImportService.validateImport(siteId, file.buffer);

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async executeImportCheckpoints(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const siteId = req.params.id as string;
      const file = req.file;
      if (!file) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'No file uploaded.',
        });
      }

      const result = await siteImportService.executeImport(
        siteId,
        file.buffer,
        user.id,
        user.tenantId || undefined,
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const siteController = new SiteController();
