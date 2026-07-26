import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';

import { currentUser } from '../../common/auth/current-user';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { scanCheckpointSchema } from './patrol-checkpoint.schema';
import { patrolCheckpointService } from './patrol-checkpoint.service';

function saveBase64Image(base64Str: string): string {
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Str;
    }
    const ext = matches[1].split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `checkpoint-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
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

export class PatrolCheckpointController {
  async scan(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);

      const body = scanCheckpointSchema.parse(req.body);

      let imageUrls: string[] = [];
      if (body.images && body.images.length > 0) {
        imageUrls = body.images.map((img: string) => saveBase64Image(img));
      }

      const result = await patrolCheckpointService.scan(user.employeeId!, {
        ...body,
        images: imageUrls,
      });

      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async history(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patrolCheckpointService.history(
        req.params.sessionId as string,
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async updateRemarks(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { remarks } = req.body;

      const result = await patrolCheckpointService.updateRemarks(id, remarks || '');

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const patrolCheckpointController = new PatrolCheckpointController();
