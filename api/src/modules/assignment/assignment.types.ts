export interface CreateAssignmentDto {
  employeeId: string;
  siteId: string;
  shiftId: string;
  patrolRouteId: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface UpdateAssignmentDto {
  siteId?: string;
  shiftId?: string;
  patrolRouteId?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  isActive?: boolean;
}
