import bcrypt from 'bcrypt';

import { appConfig } from '../../config/app.config';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, appConfig.bcrypt.saltRounds);
}

export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
