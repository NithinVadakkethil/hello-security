export interface CreateShiftDto {
  name: string;

  startTime: string;

  endTime: string;

  description?: string;
}

export interface UpdateShiftDto {
  name?: string;

  startTime?: string;

  endTime?: string;

  description?: string;

  isActive?: boolean;
}
