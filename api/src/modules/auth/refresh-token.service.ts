import crypto from 'crypto';

import { prisma } from '../../database/prisma';

export class RefreshTokenService {
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async save(
    userId: string,
    clientId: string | null,
    token: string,
    expiresAt: Date,
  ) {
    return prisma.refreshToken.create({
      data: {
        userId,
        clientId,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
    });
  }

  async find(token: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
      },
      include: {
        user: true,
      },
    });
  }

  async revoke(token: string) {
    return prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAll(userId: string) {
    return prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}

export const refreshTokenService = new RefreshTokenService();
