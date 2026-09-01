export interface SubTaskResponseDto {
  gateSubTaskId: string;
  answer: 'YES' | 'NO';
  remarks?: string;
  images?: string[];
}

export interface ScanCheckpointDto {
  gateId: string;
  patrolSessionId?: string;

  latitude?: number;

  longitude?: number;

  remarks?: string;

  status?: string;

  images?: string[];

  subTaskResponses?: SubTaskResponseDto[];
}
