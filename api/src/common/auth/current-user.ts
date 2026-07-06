import { UserRole } from '@prisma/client';

export interface CurrentUser {
  id: string;
  tenantId: string | null;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

export {};
