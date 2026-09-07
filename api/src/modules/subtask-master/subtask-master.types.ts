import { UserRole } from '@prisma/client';

export interface CreateSubTaskMasterItemDto {
  taskName: string;
  description?: string;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
}

export interface UpdateSubTaskMasterItemDto {
  taskName?: string;
  description?: string;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
}

export interface CreateOrUpdateSubTaskMasterDto {
  role: UserRole;
  name?: string;
  description?: string;
  items: CreateSubTaskMasterItemDto[];
}

export interface ApplySubtaskMasterDto {
  roles: UserRole[];
  mode?: 'MISSING_ONLY';
}

export interface RoleApplyPreviewResult {
  role: UserRole;
  roleDisplay: string;
  masterTaskCount: number;
  createCount: number;
  skipCount: number;
}

export interface ApplySubtaskMasterPreviewResponse {
  siteId: string;
  siteName: string;
  checkpointCount: number;
  roles: RoleApplyPreviewResult[];
  totalCreateCount: number;
  totalSkipCount: number;
}

export interface ApplySubtaskMasterExecuteResponse {
  siteId: string;
  siteName: string;
  checkpointCount: number;
  createdTasksCount: number;
  skippedTasksCount: number;
  roles: RoleApplyPreviewResult[];
}
