import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { getImageMetadata } from '../../common/utils/image-metadata.util';
import { prisma } from '../../database/prisma';

export class ClientBrandingController {
  private removeOldFile(fileUrl?: string | null) {
    if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
    try {
      const fileName = path.basename(fileUrl);
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Failed to clean up old branding file:', err);
    }
  }

  async getBranding(req: Request, res: Response) {
    const clientId = req.user?.tenantId;
    if (!clientId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Client ID is required.',
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        companyName: true,
        clientLogoUrl: true,
        dashboardImageUrl: true,
        dashboardImageAspectRatio: true,
        dashboardImageOrientation: true,
        dashboardImageFocalPosition: true,
      },
    });

    if (!client) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Client record not found.',
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        companyName: client.companyName,
        clientLogoUrl: client.clientLogoUrl,
        dashboardImageUrl: client.dashboardImageUrl,
        dashboardImageAspectRatio: client.dashboardImageAspectRatio,
        dashboardImageOrientation: client.dashboardImageOrientation || 'LANDSCAPE',
        dashboardImageFocalPosition: client.dashboardImageFocalPosition || 'center',
      },
    });
  }

  async uploadLogo(req: Request, res: Response) {
    const clientId = req.user?.tenantId;
    if (!clientId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Client ID is required.',
      );
    }

    const file = req.file;
    if (!file) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'No logo file uploaded.',
      );
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Logo must be JPEG, PNG, or WebP.',
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Logo image file size must be less than 2 MB.',
      );
    }

    const ext = path.extname(file.originalname) || '.webp';
    const filename = `branding-logo-${clientId}-${Date.now()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const destPath = path.join(uploadDir, filename);
    fs.renameSync(file.path, destPath);

    const logoUrl = `/uploads/${filename}`;

    const existingClient = await prisma.client.findUnique({
      where: { id: clientId },
      select: { clientLogoUrl: true },
    });

    if (existingClient?.clientLogoUrl) {
      this.removeOldFile(existingClient.clientLogoUrl);
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: { clientLogoUrl: logoUrl },
      select: { clientLogoUrl: true, companyName: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        clientLogoUrl: updatedClient.clientLogoUrl,
        companyName: updatedClient.companyName,
      },
    });
  }

  async uploadDashboardImage(req: Request, res: Response) {
    const clientId = req.user?.tenantId;
    if (!clientId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Client ID is required.',
      );
    }

    const file = req.file;
    if (!file) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'No dashboard image file uploaded.',
      );
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Dashboard building image must be JPEG, PNG, or WebP.',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Dashboard image file size must be less than 10 MB.',
      );
    }

    const ext = path.extname(file.originalname) || '.webp';
    const filename = `branding-dashboard-${clientId}-${Date.now()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const destPath = path.join(uploadDir, filename);
    fs.renameSync(file.path, destPath);

    const dashboardImageUrl = `/uploads/${filename}`;
    const meta = getImageMetadata(destPath);

    const existingClient = await prisma.client.findUnique({
      where: { id: clientId },
      select: { dashboardImageUrl: true },
    });

    if (existingClient?.dashboardImageUrl) {
      this.removeOldFile(existingClient.dashboardImageUrl);
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        dashboardImageUrl,
        dashboardImageAspectRatio: meta?.aspectRatio ?? null,
        dashboardImageOrientation: meta?.orientation ?? 'LANDSCAPE',
        dashboardImageFocalPosition: 'center',
      },
      select: {
        dashboardImageUrl: true,
        dashboardImageAspectRatio: true,
        dashboardImageOrientation: true,
        dashboardImageFocalPosition: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        dashboardImageUrl: updatedClient.dashboardImageUrl,
        dashboardImageAspectRatio: updatedClient.dashboardImageAspectRatio,
        dashboardImageOrientation: updatedClient.dashboardImageOrientation,
        dashboardImageFocalPosition: updatedClient.dashboardImageFocalPosition,
      },
    });
  }

  async updateFocalPosition(req: Request, res: Response) {
    const clientId = req.user?.tenantId;
    if (!clientId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Client ID is required.',
      );
    }

    const { focalPosition } = req.body;
    const validPositions = ['center', 'top', 'bottom', 'left', 'right'];
    if (!validPositions.includes(focalPosition)) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Invalid focal position. Allowed: center, top, bottom, left, right.',
      );
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: { dashboardImageFocalPosition: focalPosition },
      select: { dashboardImageFocalPosition: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        dashboardImageFocalPosition: updatedClient.dashboardImageFocalPosition,
      },
    });
  }

  async removeLogo(req: Request, res: Response) {
    const clientId = req.user?.tenantId;
    if (!clientId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Client ID is required.',
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { clientLogoUrl: true },
    });

    if (client?.clientLogoUrl) {
      this.removeOldFile(client.clientLogoUrl);
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { clientLogoUrl: null },
    });

    return res.status(200).json({
      success: true,
      message: 'Client logo removed successfully.',
    });
  }

  async removeDashboardImage(req: Request, res: Response) {
    const clientId = req.user?.tenantId;
    if (!clientId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Client ID is required.',
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { dashboardImageUrl: true },
    });

    if (client?.dashboardImageUrl) {
      this.removeOldFile(client.dashboardImageUrl);
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        dashboardImageUrl: null,
        dashboardImageAspectRatio: null,
        dashboardImageOrientation: 'LANDSCAPE',
        dashboardImageFocalPosition: 'center',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Dashboard building image removed successfully.',
    });
  }
}

export const clientBrandingController = new ClientBrandingController();
