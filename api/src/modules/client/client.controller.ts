import { NextFunction, Request, Response } from 'express';

import { HttpStatus } from '../../common/errors/HttpStatus';

import { createClientSchema, updateClientSchema } from './client.schema';
import { clientService } from './client.service';

export class ClientController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createClientSchema.parse(req.body);

      const result = await clientService.create(body);

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 10);
      const search = req.query.search as string | undefined;

      const result = await clientService.list(page, limit, search);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clientService.getById(req.params.id as string);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateClientSchema.parse(req.body);

      const result = await clientService.update(req.params.id as string, body);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getResourceLimits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const clientId = user.tenantId;

      if (!clientId) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Client ID missing in request context.',
        });
        return;
      }

      const result = await clientService.getResourceLimits(clientId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const clientController = new ClientController();
