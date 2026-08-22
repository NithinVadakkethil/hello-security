import { addDays } from 'date-fns';
import { authRepository } from './auth.repository';
import { prisma } from '../../database/prisma';

import { comparePassword, hashPassword } from '../../common/auth/bcrypt';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../common/auth/jwt';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';

import { LoginResponse } from './auth.types';

export class AuthService {
  async login(
    email: string,
    password: string,
    deviceId?: string,
    deviceInfo?: string,
  ): Promise<LoginResponse> {
    const user = await authRepository.findUserByEmail(email);

    if (!user) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Invalid email or password',
      );
    }

    if (!user.isActive) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Your account is disabled.',
      );
    }

    const passwordMatched = await comparePassword(password, user.password);

    if (!passwordMatched) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Invalid email or password',
      );
    }

    const payload = {
      sub: user.id,
      tenantId: user.clientId,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const hashedRefreshToken = await hashPassword(refreshToken);

    await prisma.$transaction(async (tx) => {
      // Lock user row to prevent concurrent race conditions
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;

      if (deviceId) {
        // Single Mobile Device restriction logic
        const activeMobileSessions = await authRepository.findActiveMobileSessions(user.id, tx);
        const otherDeviceSession = activeMobileSessions.find((s: any) => s.deviceId !== deviceId);

        if (otherDeviceSession) {
          throw new AppError(
            HttpStatus.CONFLICT,
            ErrorCodes.USER_ALREADY_LOGGED_IN,
            'Your account is already logged in on another device. Please log out from the other device before trying again.',
          );
        }

        // Revoke any previous token for this same device
        await authRepository.revokeMobileSession(user.id, deviceId, tx);

        // Create new active mobile refresh token
        await authRepository.createRefreshToken(
          {
            clientId: user.clientId,
            userId: user.id,
            tokenHash: hashedRefreshToken,
            deviceId,
            deviceInfo,
            expiresAt: addDays(new Date(), 7),
          },
          tx,
        );
      } else {
        // Web / Non-mobile login flow
        await authRepository.revokeAllRefreshTokens(user.id, tx);
        await authRepository.createRefreshToken(
          {
            clientId: user.clientId,
            userId: user.id,
            tokenHash: hashedRefreshToken,
            expiresAt: addDays(new Date(), 7),
          },
          tx,
        );
      }

      await authRepository.updateLastLogin(user.id, tx);
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        tenantId: user.clientId,
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
        firstName: (user as any).employee?.firstName || null,
        lastName: (user as any).employee?.lastName || null,
        companyName: (user as any).client?.companyName || null,
        name:
          (user as any).client?.companyName ||
          ((user as any).employee
            ? `${(user as any).employee.firstName} ${(user as any).employee.lastName}`
            : user.email.split('@')[0]),
      },
    };
  }

  async logout(userId: string, deviceId?: string): Promise<{ success: boolean }> {
    if (deviceId) {
      await authRepository.revokeMobileSession(userId, deviceId);
    } else {
      await authRepository.revokeAllRefreshTokens(userId);
    }
    return { success: true };
  }
  async refresh(refreshToken: string): Promise<LoginResponse> {
    const payload = verifyRefreshToken(refreshToken);

    const user = await authRepository.findUserById(payload.sub);

    if (!user) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Invalid refresh token.',
      );
    }

    const tokens = await authRepository.findRefreshTokensByUser(user.id);

    let matched = false;

    for (const token of tokens) {
      const valid = await comparePassword(refreshToken, token.tokenHash);

      if (valid) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Refresh token revoked.',
      );
    }

    const userPayload = {
      sub: user.id,
      tenantId: user.clientId,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
    };

    const newAccessToken = signAccessToken(userPayload);
    const newRefreshToken = signRefreshToken(userPayload);
    const hashedRefreshToken = await hashPassword(newRefreshToken);

    await authRepository.revokeAllRefreshTokens(user.id);

    await authRepository.createRefreshToken({
      clientId: user.clientId,
      userId: user.id,
      tokenHash: hashedRefreshToken,
      expiresAt: addDays(new Date(), 7),
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        tenantId: user.clientId,
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
        firstName: (user as any).employee?.firstName || null,
        lastName: (user as any).employee?.lastName || null,
        companyName: (user as any).client?.companyName || null,
        name: (user as any).client?.companyName ||
          ((user as any).employee
            ? `${(user as any).employee.firstName} ${(user as any).employee.lastName}`
            : user.email.split('@')[0]),
      },
    };
  }

  async getProfile(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'User not found.',
      );
    }
    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      tenantId: user.clientId,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      firstName: (user as any).employee?.firstName || null,
      lastName: (user as any).employee?.lastName || null,
      companyName: (user as any).client?.companyName || null,
      name:
        (user as any).client?.companyName ||
        ((user as any).employee
          ? `${(user as any).employee.firstName} ${(user as any).employee.lastName}`
          : user.email.split('@')[0]),
    };
  }

  async updateProfile(userId: string, data: { email: string }) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'User not found.',
      );
    }

    if (data.email !== user.email) {
      const existing = await authRepository.findUserByEmail(data.email);
      if (existing) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          'A user with this email already exists.',
        );
      }
    }

    const updated = await authRepository.updateUser(userId, {
      email: data.email,
    });

    const { password, ...safeUser } = updated;
    return safeUser;
  }

  async changePassword(
    userId: string,
    data: { currentPassword?: string; newPassword?: string },
  ) {
    if (!data.currentPassword || !data.newPassword) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        'Current and new password are required.',
      );
    }

    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'User not found.',
      );
    }

    const isMatch = await comparePassword(data.currentPassword, user.password);
    if (!isMatch) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Invalid current password.',
      );
    }

    const hashed = await hashPassword(data.newPassword);
    await authRepository.updateUser(userId, {
      password: hashed,
    });

    return { success: true };
  }
}

export const authService = new AuthService();
