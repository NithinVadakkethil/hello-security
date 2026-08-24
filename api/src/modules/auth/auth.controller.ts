import { NextFunction, Request, Response } from 'express';

import { authService } from './auth.service';
import { loginSchema, logoutAllDevicesSchema } from './auth.validation';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = loginSchema.parse(req.body);

      const result = await authService.login(
        body.email,
        body.password,
        body.deviceId,
        body.deviceInfo,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logoutAllDevices(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = logoutAllDevicesSchema.parse(req.body);

      const result = await authService.logoutAllDevices(
        body.email,
        body.password,
        body.deviceId,
        body.deviceInfo,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const deviceId = (req.body?.deviceId as string) || (req.query?.deviceId as string);
      const result = await authService.logout(user.id, deviceId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const result = await authService.getProfile(user.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const result = await authService.updateProfile(user.id, req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const result = await authService.changePassword(user.id, req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
