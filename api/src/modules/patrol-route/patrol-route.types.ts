export interface PatrolCheckpointDto {
  gateId: string;
  sequence: number;
  expectedDuration?: number;
}

export interface CreatePatrolRouteDto {
  siteId: string;
  name: string;
  description?: string | null;
  checkpoints: PatrolCheckpointDto[];
}

export interface UpdatePatrolRouteDto {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  checkpoints?: PatrolCheckpointDto[];
}
