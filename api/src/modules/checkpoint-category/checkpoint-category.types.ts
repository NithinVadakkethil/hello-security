import { UserRole } from '@prisma/client';

export interface CreateCheckpointCategoryDto {
  name: string;
  description?: string | null;
}

export interface UpdateCheckpointCategoryDto {
  name?: string;
  description?: string | null;
}

export interface CreateCategorySubTaskDto {
  role: UserRole;
  taskName: string;
  description?: string | null;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
}

export interface UpdateCategorySubTaskDto {
  role?: UserRole;
  taskName?: string;
  description?: string | null;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
}

export interface ReorderCategorySubTasksDto {
  subTasks: Array<{
    id: string;
    displayOrder: number;
  }>;
}

export interface CheckpointCategorySummary {
  id: string;
  clientId: string;
  name: string;
  normalizedName: string;
  description?: string | null;
  checkpointsCount: number;
  subTasksCount: number;
  subTasksByRole: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}
