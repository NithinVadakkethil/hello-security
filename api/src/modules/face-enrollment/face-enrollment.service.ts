import { FaceEnrollmentStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { decryptFaceTemplate, encryptFaceTemplate } from '../../common/security/face-template-crypto';

export class FaceEnrollmentService {
  async getStatus(employeeId: string) {
    const enrollment = await prisma.faceEnrollment.findUnique({
      where: { employeeId },
      select: {
        id: true,
        status: true,
        modelName: true,
        modelVersion: true,
        embeddingDimension: true,
        registeredAt: true,
        updatedAt: true,
        revokedAt: true,
      },
    });

    if (!enrollment) {
      return {
        status: FaceEnrollmentStatus.NOT_REGISTERED,
        registeredAt: null,
      };
    }

    return {
      status: enrollment.status,
      registeredAt: enrollment.registeredAt,
      modelName: enrollment.modelName,
      modelVersion: enrollment.modelVersion,
      embeddingDimension: enrollment.embeddingDimension,
    };
  }

  async registerFace(
    employeeId: string,
    clientId: string,
    data: { template: number[]; modelName?: string; modelVersion?: string; embeddingDimension?: number },
  ) {
    if (!data.template || !Array.isArray(data.template) || data.template.length === 0) {
      throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'Invalid biometric face template.');
    }

    const encryptedTemplate = encryptFaceTemplate(data.template);
    const modelName = data.modelName || 'MobileFaceNet';
    const modelVersion = data.modelVersion || 'v1';
    const embeddingDimension = data.embeddingDimension || data.template.length;

    const enrollment = await prisma.faceEnrollment.upsert({
      where: { employeeId },
      create: {
        employeeId,
        clientId,
        status: FaceEnrollmentStatus.REGISTERED,
        encryptedTemplate,
        modelName,
        modelVersion,
        embeddingDimension,
        registeredAt: new Date(),
      },
      update: {
        clientId,
        status: FaceEnrollmentStatus.REGISTERED,
        encryptedTemplate,
        modelName,
        modelVersion,
        embeddingDimension,
        registeredAt: new Date(),
        revokedAt: null,
      },
    });

    return {
      status: enrollment.status,
      registeredAt: enrollment.registeredAt,
      modelName: enrollment.modelName,
      modelVersion: enrollment.modelVersion,
      embeddingDimension: enrollment.embeddingDimension,
    };
  }

  async getTemplate(employeeId: string) {
    const enrollment = await prisma.faceEnrollment.findUnique({
      where: { employeeId },
    });

    if (!enrollment || enrollment.status !== FaceEnrollmentStatus.REGISTERED) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'No active face enrollment found.');
    }

    const decryptedTemplate = decryptFaceTemplate(enrollment.encryptedTemplate);

    return {
      status: enrollment.status,
      template: decryptedTemplate,
      modelName: enrollment.modelName,
      modelVersion: enrollment.modelVersion,
      embeddingDimension: enrollment.embeddingDimension,
      registeredAt: enrollment.registeredAt,
    };
  }

  async revokeFace(employeeId: string) {
    const enrollment = await prisma.faceEnrollment.findUnique({
      where: { employeeId },
    });

    if (!enrollment) {
      throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'No face enrollment found.');
    }

    const updated = await prisma.faceEnrollment.update({
      where: { employeeId },
      data: {
        status: FaceEnrollmentStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    return {
      status: updated.status,
      revokedAt: updated.revokedAt,
    };
  }
}

export const faceEnrollmentService = new FaceEnrollmentService();
