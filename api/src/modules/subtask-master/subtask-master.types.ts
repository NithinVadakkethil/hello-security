import { UserRole } from '@prisma/client';

export interface CreateSubTaskMasterItemDto {
  id?: string;
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
  updateCount: number;
  removeCount: number;
  preserveManualCount: number;
  skipCount: number;
}

export interface ApplySubtaskMasterPreviewResponse {
  siteId: string;
  siteName: string;
  checkpointCount: number;
  roles: RoleApplyPreviewResult[];
  totalCreateCount: number;
  totalUpdateCount: number;
  totalRemoveCount: number;
  totalPreserveManualCount: number;
  totalSkipCount: number;
}

export interface ApplySubtaskMasterExecuteResponse {
  siteId: string;
  siteName: string;
  checkpointCount: number;
  createdTasksCount: number;
  updatedTasksCount: number;
  removedTasksCount: number;
  preservedManualTasksCount: number;
  skippedTasksCount: number;
  roles: RoleApplyPreviewResult[];
}
