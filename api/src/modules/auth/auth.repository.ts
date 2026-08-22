import { prisma } from '../../database/prisma';

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        client: true,
        employee: true,
      },
    });
  }

  async createRefreshToken(
    data: {
      clientId: string | null;
      userId: string;
      tokenHash: string;
      deviceId?: string | null;
      deviceInfo?: string | null;
      expiresAt: Date;
    },
    tx?: any,
  ) {
    const db = tx || prisma;
    return db.refreshToken.create({
      data,
    });
  }

  async updateLastLogin(userId: string, tx?: any) {
    const db = tx || prisma;
    return db.user.update({
      where: {
        id: userId,
      },
      data: {
        lastLogin: new Date(),
      },
    });
  }

  async findRefreshTokensByUser(userId: string, tx?: any) {
    const db = tx || prisma;
    return db.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  async findActiveMobileSessions(userId: string, tx?: any) {
    const db = tx || prisma;
    return db.refreshToken.findMany({
      where: {
        userId,
        deviceId: {
          not: null,
        },
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        client: true,
        employee: true,
      },
    });
  }

  async revokeAllRefreshTokens(userId: string, tx?: any) {
    const db = tx || prisma;
    return db.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeMobileSession(userId: string, deviceId?: string | null, tx?: any) {
    const db = tx || prisma;
    return db.refreshToken.updateMany({
      where: {
        userId,
        ...(deviceId ? { deviceId } : { deviceId: { not: null } }),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async updateUser(userId: string, data: any) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}

export const authRepository = new AuthRepository();
