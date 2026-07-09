export interface CreatePatrolRouteGateDto {
  gateId: string;
  sequence: number;
}

export interface UpdatePatrolRouteGateDto {
  sequence?: number;
}
