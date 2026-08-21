import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { createIncidentSchema } from './incident.schema';
import { incidentService } from './incident.service';

function saveBase64Image(base64Str: string): string {
  try {
    if (!base64Str) return '';
    if (base64Str.startsWith('/uploads/') || base64Str.startsWith('http://') || base64Str.startsWith('https://')) {
      return base64Str;
    }

    let ext = 'png';
    let base64Data = base64Str.trim();

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/s);
    if (matches && matches.length === 3) {
      const mime = matches[1];
      ext = mime.split('/')[1] || 'png';
      base64Data = matches[2];
    } else if (base64Data.startsWith('/9j/')) {
      ext = 'jpg';
    } else if (base64Data.startsWith('iVBOR')) {
      ext = 'png';
    } else if (base64Data.startsWith('R0lG')) {
      ext = 'gif';
    } else if (base64Data.startsWith('UklGR')) {
      ext = 'webp';
    }

    base64Data = base64Data.replace(/[\r\n\s]+/g, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0) {
      return base64Str;
    }

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

import { resolveEmployeeId } from '../../common/auth/resolve-employee';

export class IncidentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const employeeId = await resolveEmployeeId(user);
      const body = createIncidentSchema.parse(req.body);

      const files = req.files as Express.Multer.File[] | undefined;
      let imageUrls = files ? files.map((f) => `/uploads/${f.filename}`) : [];

      if (body.images && body.images.length > 0) {
        const base64Urls = body.images.map((img: string) => saveBase64Image(img));
        imageUrls = [...imageUrls, ...base64Urls];
      }

      const result = await incidentService.create(
        user.tenantId!,
        employeeId,
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

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const result = await incidentService.updateStatus(id as string, status as string);

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
