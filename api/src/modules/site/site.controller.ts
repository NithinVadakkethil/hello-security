import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { createSiteSchema, updateSiteSchema } from './site.schema';
import { siteService } from './site.service';

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
}

export const siteController = new SiteController();
