export interface PatrolCheckpointDto {
  gateId: string;
  sequence: number;
  expectedDuration?: number;
}

export interface CreatePatrolRouteDto {
  siteId: string;
  name: string;
  description?: string;
  checkpoints: PatrolCheckpointDto[];
}

export interface UpdatePatrolRouteDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}
