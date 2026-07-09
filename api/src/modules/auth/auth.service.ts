import { addDays } from 'date-fns';
import { authRepository } from './auth.repository';

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
  async login(email: string, password: string): Promise<LoginResponse> {
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

    await authRepository.revokeAllRefreshTokens(user.id);

    await authRepository.createRefreshToken({
      clientId: user.clientId,
      userId: user.id,
      tokenHash: hashedRefreshToken,
      expiresAt: addDays(new Date(), 7),
    });

    await authRepository.updateLastLogin(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        tenantId: user.clientId,
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
      },
    };
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

    // We'll continue from here in the next step.
    throw new Error('Not implemented yet.');
  }
}

export const authService = new AuthService();
