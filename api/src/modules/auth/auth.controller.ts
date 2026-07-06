import { NextFunction, Request, Response } from 'express';

import { authService } from './auth.service';
import { loginSchema } from './auth.validation';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = loginSchema.parse(req.body);

      const result = await authService.login(body.email, body.password);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
