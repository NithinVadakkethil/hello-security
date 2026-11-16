export interface CreateShiftDto {
  name: string;
  startTime: string;
  endTime: string;
  mandatoryPatrol1Time?: string | null;
  mandatoryPatrol1WindowBefore?: number;
  mandatoryPatrol1WindowAfter?: number;
  mandatoryPatrol2Time?: string | null;
  mandatoryPatrol2WindowBefore?: number;
  mandatoryPatrol2WindowAfter?: number;
  description?: string;
}

export interface UpdateShiftDto {
  name?: string;
  startTime?: string;
  endTime?: string;
  mandatoryPatrol1Time?: string | null;
  mandatoryPatrol1WindowBefore?: number;
  mandatoryPatrol1WindowAfter?: number;
  mandatoryPatrol2Time?: string | null;
  mandatoryPatrol2WindowBefore?: number;
  mandatoryPatrol2WindowAfter?: number;
  description?: string;
  isActive?: boolean;
}
