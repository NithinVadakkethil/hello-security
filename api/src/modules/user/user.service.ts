import { randomBytes } from 'crypto';
import { hashPassword } from '../../common/auth/bcrypt';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { userRepository } from './user.repository';

export class UserService {
  async list(page = 1, limit = 10, search?: string, role?: string, clientId?: string) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      userRepository.list(skip, limit, search, role, clientId),
      userRepository.count(search, role, clientId),
    ]);

    return {
      items: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'User not found.',
      );
    }
    return user;
  }

  async create(data: { email: string; role: string; clientId?: string; employeeId?: string; password?: string }) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError(
        HttpStatus.CONFLICT,
        ErrorCodes.VALIDATION_ERROR,
        'A user with this email already exists.',
      );
    }

    const rawPassword = data.password || randomBytes(6).toString('hex');
    const hashedPassword = await hashPassword(rawPassword);

    const user = await userRepository.create({
      email: data.email,
      role: data.role as any,
      clientId: data.clientId || null,
      employeeId: data.employeeId || null,
      password: hashedPassword,
      isActive: true,
    });

    return {
      user,
      temporaryPassword: data.password ? undefined : rawPassword,
    };
  }

  async update(id: string, data: { email?: string; role?: string }) {
    const user = await this.getById(id);

    if (data.email && data.email !== user.email) {
      const existing = await userRepository.findByEmail(data.email);
      if (existing) {
        throw new AppError(
          HttpStatus.CONFLICT,
          ErrorCodes.VALIDATION_ERROR,
          'A user with this email already exists.',
        );
      }
    }

    return userRepository.update(id, {
      email: data.email,
      role: data.role as any,
    });
  }

  async setStatus(id: string, isActive: boolean) {
    await this.getById(id);
    return userRepository.update(id, { isActive });
  }

  async resetPassword(id: string, newPassword?: string) {
    await this.getById(id);

    const rawPassword = newPassword || randomBytes(6).toString('hex');
    const hashedPassword = await hashPassword(rawPassword);

    await userRepository.update(id, { password: hashedPassword });

    return {
      success: true,
      temporaryPassword: rawPassword,
    };
  }
}

export const userService = new UserService();
