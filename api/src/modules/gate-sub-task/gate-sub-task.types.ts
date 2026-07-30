export interface CreateGateSubTaskDto {
  taskName: string;
  description?: string;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
}

export interface UpdateGateSubTaskDto {
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
