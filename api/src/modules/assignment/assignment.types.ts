export interface CreateAssignmentDto {
  employeeId?: string;
  employeeIds?: string[];
  siteId: string;
  shiftId: string;
  assignmentType?: 'ROUTE' | 'DIRECT_CHECKPOINTS';
  patrolRouteId?: string;
  gateIds?: string[];
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface UpdateAssignmentDto {
  siteId?: string;
  shiftId?: string;
  assignmentType?: 'ROUTE' | 'DIRECT_CHECKPOINTS';
  patrolRouteId?: string;
  gateIds?: string[];
  effectiveFrom?: Date;
  effectiveTo?: Date;
  isActive?: boolean;
}
