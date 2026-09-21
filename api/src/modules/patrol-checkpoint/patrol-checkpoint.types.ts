export interface SubTaskResponseDto {
  gateSubTaskId: string;
  answer: 'YES' | 'NO';
  remarks?: string | null;
  images?: string[];
  answeredAt?: string;
}

export interface ScanCheckpointDto {
  gateId: string;
  patrolSessionId?: string;

  latitude?: number;

  longitude?: number;

  remarks?: string | null;

  status?: string;

  images?: string[];

  scannedAt?: string;

  subTaskResponses?: SubTaskResponseDto[];
}
