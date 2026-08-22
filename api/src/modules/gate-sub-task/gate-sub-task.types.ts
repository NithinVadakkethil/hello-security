import { UserRole } from '@prisma/client';

export interface CreateGateSubTaskDto {
  role?: UserRole;
  taskName: string;
  description?: string;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
}

export interface UpdateGateSubTaskDto {
  role?: UserRole;
  taskName?: string;
  description?: string;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
}

export interface ReorderGateSubTasksDto {
  subTasks: Array<{
    id: string;
    displayOrder: number;
  }>;
}

export interface GateSubTaskQueryDto {
  role?: UserRole;
  isActive?: boolean;
}
