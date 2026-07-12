import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { createIncidentSchema } from './incident.schema';
import { incidentService } from './incident.service';

function saveBase64Image(base64Str: string): string {
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Str;
    }
    const ext = matches[1].split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `incident-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return `/uploads/${filename}`;
  } catch {
    return base64Str;
  }
}

export class IncidentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const body = createIncidentSchema.parse(req.body);

      const files = req.files as Express.Multer.File[] | undefined;
      let imageUrls = files ? files.map((f) => `/uploads/${f.filename}`) : [];

      if (body.images && body.images.length > 0) {
        const base64Urls = body.images.map((img: string) => saveBase64Image(img));
        imageUrls = [...imageUrls, ...base64Urls];
      }

      const result = await incidentService.create(
        user.tenantId!,
        user.employeeId!,
        {
          ...body,
          images: imageUrls,
        }
      );

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
      const result = await incidentService.list(user.tenantId!);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await incidentService.findById(req.params.id as string);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Incident not found.',
        });
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const incidentController = new IncidentController();
