import { prisma } from '../../database/prisma';

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        client: true,
      },
    });
  }

  async createRefreshToken(data: {
    clientId: string | null;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({
      data,
    });
  }

  async updateLastLogin(userId: string) {
    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        lastLogin: new Date(),
      },
    });
  }

  async findRefreshTokensByUser(userId: string) {
    return prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
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
      },
    });
  }

  async revokeAllRefreshTokens(userId: string) {
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

  async updateUser(userId: string, data: any) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}

export const authRepository = new AuthRepository();
